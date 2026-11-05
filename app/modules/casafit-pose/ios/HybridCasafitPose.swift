// UNBUILT: iOS implementation written to the same spec as the Kotlin one. It has not been compiled.
// Expect to fix small API mismatches on the first Mac build (MPPPoseLandmarker names, NativeFrame access).
//
// Privacy: the frame is read and released inside detect(). No file, network or logging of pixels or
// landmarks. The model is a bundled resource.

import AVFoundation
import CoreMedia
import Foundation
import MediaPipeTasksVision
import UIKit
import NitroModules
import VisionCamera

final class HybridCasafitPose: HybridCasafitPoseSpec {
  private let lock = NSLock()
  private var landmarker: PoseLandmarker?
  private var minIntervalMs: Int = 0
  private var lastRunMs: Int = Int.min
  private var lastStreamMs: Int = Int.min

  var memorySize: Int { 12 * 1024 * 1024 }

  func open(minDetect: Double, minPresence: Double, minTrack: Double, maxHz: Double) throws {
    lock.lock()
    defer { lock.unlock() }
    landmarker = nil

    guard let path = Bundle(for: HybridCasafitPose.self).path(forResource: "pose_landmarker_lite", ofType: "task") else {
      throw RuntimeError.error(withMessage: "casafit-pose: pose_landmarker_lite.task is missing from the bundle.")
    }
    let options = PoseLandmarkerOptions()
    options.baseOptions.modelAssetPath = path
    options.baseOptions.delegate = .CPU
    options.runningMode = .video
    options.numPoses = 1
    options.minPoseDetectionConfidence = Float(minDetect)
    options.minPosePresenceConfidence = Float(minPresence)
    options.minTrackingConfidence = Float(minTrack)
    options.shouldOutputSegmentationMasks = false
    do {
      landmarker = try PoseLandmarker(options: options)
    } catch {
      throw RuntimeError.error(withMessage: "casafit-pose: could not create the pose landmarker.")
    }
    minIntervalMs = maxHz > 0 ? Int(1000.0 / maxHz) : 0
    lastRunMs = Int.min
    lastStreamMs = Int.min
  }

  func detect(frame: any HybridFrameSpec, orientation: CameraOrientation, isMirrored: Bool) throws -> ArrayBuffer? {
    // `isMirrored` is part of the contract and changes nothing here: landmarks are returned in the
    // unmirrored upright image and the overlay mirrors itself for a front camera.
    lock.lock()
    defer { lock.unlock() }
    guard let landmarker else { return nil }
    guard let native = frame as? any NativeFrame, let sampleBuffer = native.sampleBuffer else { return nil }

    let seconds = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
    guard seconds.isFinite else { return nil }
    let frameMs = Int(seconds * 1000.0)
    if lastRunMs != Int.min && frameMs - lastRunMs < minIntervalMs { return nil }
    let streamMs = frameMs <= lastStreamMs ? lastStreamMs + 1 : frameMs

    do {
      let image = try MPImage(sampleBuffer: sampleBuffer, orientation: Self.uiOrientation(orientation))
      let result = try landmarker.detect(videoFrame: image, timestampInMilliseconds: streamMs)
      lastRunMs = frameMs
      lastStreamMs = streamMs
      return Self.pack(result)
    } catch {
      return nil
    }
  }

  func close() throws {
    lock.lock()
    defer { lock.unlock() }
    landmarker = nil
  }

  /// Same packing as Android: 33 x (x, y, z, visibility), then the 33 world landmarks.
  private static func pack(_ result: PoseLandmarkerResult) -> ArrayBuffer? {
    guard let image = result.landmarks.first, image.count >= 33 else { return nil }
    let world = result.worldLandmarks.first
    var floats = [Float](repeating: 0, count: 33 * 4 * 2)
    for i in 0..<33 {
      let p = image[i]
      floats[i * 4] = p.x
      floats[i * 4 + 1] = p.y
      floats[i * 4 + 2] = p.z
      floats[i * 4 + 3] = p.visibility?.floatValue ?? 0
    }
    if let world, world.count >= 33 {
      for i in 0..<33 {
        let p = world[i]
        let o = 33 * 4 + i * 4
        floats[o] = p.x
        floats[o + 1] = p.y
        floats[o + 2] = p.z
        floats[o + 3] = p.visibility?.floatValue ?? 0
      }
    }
    let buffer = ArrayBuffer.allocate(size: floats.count * MemoryLayout<Float>.size)
    floats.withUnsafeBytes { raw in
      buffer.data.copyMemory(from: raw.baseAddress!, byteCount: raw.count)
    }
    return buffer
  }

  /// vision-camera: the orientation of the buffer relative to upright. UNVERIFIED mapping, check on a device
  /// with the rear and the front camera.
  private static func uiOrientation(_ o: CameraOrientation) -> UIImage.Orientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    }
  }
}
