// Privacy guard (docs/plans/spikes/pose.md section 6): the pose path has no way to save or send a
// frame or a landmark. This is a text-level lint over the files that touch camera frames. It is not a
// proof, so the device checklist (sandbox diff, network capture) still applies.
/* eslint-disable @typescript-eslint/no-require-imports */
// Node's fs and path are not in the app's tsconfig types, so they are required here.
const fs = require('fs') as { readdirSync(d: string): string[]; readFileSync(f: string, e: string): string; statSync(p: string): { isDirectory(): boolean } };
const path = require('path') as { join(...p: string[]): string };
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = fs;
const { join } = path;

const appRoot = join(__dirname, '..', '..', '..');
const moduleRoot = join(appRoot, 'modules', 'casafit-pose');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'build' || name === '.cxx') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // nitrogen output is generated glue, not our code; it is rebuilt from the spec.
      if (p.includes(join('nitrogen', 'generated'))) continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FORBIDDEN_NATIVE: RegExp[] = [
  /FileOutputStream|FileWriter|openFileOutput|RandomAccessFile|MediaStore|MediaRecorder|MediaMuxer/,
  /\.compress\(|Bitmap\.CompressFormat|jpegData|pngData|UIImageWriteToSavedPhotosAlbum|PHPhotoLibrary/,
  /FileManager|\.write\(to|createFile\(/,
  /HttpURLConnection|OkHttp|java\.net\.|URLSession|URLRequest|NWConnection|Socket\(/,
  /https?:\/\//,
  /Log\.(d|i|v|e)\(|NSLog|print\(|os_log/,
];

describe('casafit-pose native sources', () => {
  const files = walk(moduleRoot).filter((f) => /\.(kt|swift|ts)$/.test(f));

  it('finds the module sources', () => {
    expect(files.some((f) => f.endsWith('HybridCasafitPose.kt'))).toBe(true);
    expect(files.some((f) => f.endsWith('HybridCasafitPose.swift'))).toBe(true);
  });

  it.each(FORBIDDEN_NATIVE.map((re) => [String(re), re] as const))('has no %s', (_name, re) => {
    const hits = files.filter((f) => re.test(strip(readFileSync(f, 'utf8'))));
    expect(hits).toEqual([]);
  });

  it('pins the model hash', () => {
    const pin = readFileSync(join(moduleRoot, 'pose_landmarker_lite.task.sha256'), 'utf8');
    expect(pin).toMatch(/^[0-9a-f]{64}\s+pose_landmarker_lite\.task\s*$/);
  });
});

describe('camera outputs in the app', () => {
  const src = walk(join(appRoot, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

  it.each(['usePhotoOutput', 'useVideoOutput', 'useDepthOutput', 'createPhotoOutput', 'createVideoOutput', 'Recorder', 'takePhoto', 'takeSnapshot', 'startRecording', 'useFrameRenderer'])(
    'does not use %s',
    (token) => {
      const hits = src.filter((f) => new RegExp(`\\b${token}\\b`).test(strip(readFileSync(f, 'utf8'))));
      expect(hits).toEqual([]);
    },
  );

  it('the camera component disposes the frame in a finally block', () => {
    const text = readFileSync(join(appRoot, 'src', 'services', 'pose', 'PoseCamera.tsx'), 'utf8');
    expect(text).toMatch(/finally\s*\{\s*frame\.dispose\(\);/);
  });

  it('does not ask for the microphone, and blocks it if a library adds it', () => {
    const cfg = JSON.parse(readFileSync(join(appRoot, 'app.json'), 'utf8')) as { expo: { android: { permissions: string[]; blockedPermissions?: string[] } } };
    expect(cfg.expo.android.permissions).not.toContain('android.permission.RECORD_AUDIO');
    expect(cfg.expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  });
});
