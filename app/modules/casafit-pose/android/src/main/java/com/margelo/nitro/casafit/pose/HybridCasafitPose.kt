package com.margelo.nitro.casafit.pose

import android.graphics.ImageFormat
import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.framework.image.MediaImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.ArrayBuffer
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Pose Landmarker Lite on a vision-camera 5 frame.
 *
 * Privacy: the camera frame is read and released inside [detect]. Nothing here writes a file, a
 * bitmap to disk, a log line with pixels or landmarks, or opens a network connection. The model is a
 * bundled asset. `tools/` and CI grep this folder for the forbidden tokens.
 */
@DoNotStrip
@Keep
class HybridCasafitPose : HybridCasafitPoseSpec() {
  private val lock = Any()
  private var landmarker: PoseLandmarker? = null
  private var minIntervalMs: Long = 0
  private var lastRunMs: Long = Long.MIN_VALUE
  private var lastStreamMs: Long = Long.MIN_VALUE

  override val memorySize: Long
    get() = MODEL_BYTES_ESTIMATE

  override fun open(minDetect: Double, minPresence: Double, minTrack: Double, maxHz: Double) {
    synchronized(lock) {
      closeLocked()
      val context = NitroModules.applicationContext
        ?: throw Error("casafit-pose: React application context is not available yet.")
      val base = BaseOptions.builder()
        .setModelAssetPath(MODEL_ASSET)
        .setDelegate(Delegate.CPU)
        .build()
      val options = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(base)
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(minDetect.toFloat())
        .setMinPosePresenceConfidence(minPresence.toFloat())
        .setMinTrackingConfidence(minTrack.toFloat())
        .setOutputSegmentationMasks(false)
        .build()
      landmarker = try {
        PoseLandmarker.createFromOptions(context, options)
      } catch (e: Throwable) {
        // Most likely the asset is missing from the APK. The Gradle check should have caught that.
        throw Error("casafit-pose: could not load $MODEL_ASSET (${e.javaClass.simpleName}).")
      }
      minIntervalMs = if (maxHz > 0) (1000.0 / maxHz).toLong() else 0L
      lastRunMs = Long.MIN_VALUE
      lastStreamMs = Long.MIN_VALUE
    }
  }

  override fun detect(frame: HybridFrameSpec, orientation: CameraOrientation, isMirrored: Boolean): ArrayBuffer? {
    // `isMirrored` is part of the contract but changes nothing here: landmarks are returned in the
    // unmirrored upright image, and the overlay mirrors itself for a front camera (spike section 3).
    synchronized(lock) {
      val lm = landmarker ?: return null
      val image = (frame as? NativeFrame)?.image ?: return null

      // Throttle by the frame's own clock (ImageInfo timestamp is nanoseconds), not by wall time.
      val frameMs = image.imageInfo.timestamp / 1_000_000L
      if (lastRunMs != Long.MIN_VALUE && frameMs - lastRunMs < minIntervalMs) return null
      // detectForVideo needs strictly increasing timestamps.
      val streamMs = if (frameMs <= lastStreamMs) lastStreamMs + 1 else frameMs

      val mpImage: MPImage = try {
        val media = image.image // ImageProxy.getImage() is lint-experimental in CameraX, not a Kotlin opt-in
        when {
          media != null && media.format == ImageFormat.YUV_420_888 -> MediaImageBuilder(media).build()
          image.format == ImageFormat.YUV_420_888 || image.format == 0x1 /* RGBA_8888 */ -> BitmapImageBuilder(image.toBitmap()).build()
          else -> return null
        }
      } catch (e: Throwable) {
        warn("image", e)
        return null
      }

      return try {
        val options = ImageProcessingOptions.builder().setRotationDegrees(rotationDegrees(orientation)).build()
        val result = lm.detectForVideo(mpImage, options, streamMs)
        lastRunMs = frameMs
        lastStreamMs = streamMs
        pack(result)
      } catch (e: Throwable) {
        warn("detect", e)
        null
      } finally {
        mpImage.close()
      }
    }
  }

  override fun close() {
    synchronized(lock) { closeLocked() }
  }

  private fun closeLocked() {
    try {
      landmarker?.close()
    } catch (_: Throwable) {
      // A detector that fails to close must not block leaving the screen.
    }
    landmarker = null
  }

  override fun dispose() {
    close()
    super.dispose()
  }

  /** 33 x (x, y, z, visibility) image landmarks, then the same for world landmarks. */
  private fun pack(result: com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult): ArrayBuffer? {
    val image = result.landmarks().firstOrNull() ?: return null
    val world = result.worldLandmarks().firstOrNull()
    if (image.size < LANDMARKS) return null
    val buffer = ByteBuffer.allocateDirect(LANDMARKS * 4 * 2 * Float.SIZE_BYTES).order(ByteOrder.nativeOrder())
    for (i in 0 until LANDMARKS) {
      val p = image[i]
      buffer.putFloat(p.x())
      buffer.putFloat(p.y())
      buffer.putFloat(p.z())
      buffer.putFloat(p.visibility().orElse(0f))
    }
    for (i in 0 until LANDMARKS) {
      val p = world?.getOrNull(i)
      buffer.putFloat(p?.x() ?: 0f)
      buffer.putFloat(p?.y() ?: 0f)
      buffer.putFloat(p?.z() ?: 0f)
      buffer.putFloat(p?.visibility()?.orElse(0f) ?: 0f)
    }
    buffer.rewind()
    return ArrayBuffer.wrap(buffer)
  }

  /**
   * CameraX `rotationDegrees` is how far the buffer must turn clockwise to be upright, which vision-camera
   * reports as 90 -> left, 180 -> down, 270 -> right. MediaPipe takes the same clockwise value.
   */
  private fun rotationDegrees(o: CameraOrientation): Int = when (o) {
    CameraOrientation.UP -> 0
    CameraOrientation.LEFT -> 90
    CameraOrientation.DOWN -> 180
    CameraOrientation.RIGHT -> 270
  }

  /** Logs the stage and the exception class only. Never a message that could carry image data. */
  private fun warn(stage: String, e: Throwable) {
    Log.w(LOG_TAG, "$stage failed: ${e.javaClass.simpleName}")
  }

  companion object {
    private const val LOG_TAG = "CasafitPose"
    private const val LANDMARKS = 33
    private const val MODEL_ASSET = "pose_landmarker_lite.task"
    private const val MODEL_BYTES_ESTIMATE = 12L * 1024 * 1024
  }
}
