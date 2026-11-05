// Downloads the MediaPipe Pose Landmarker Lite bundle into assets/ and checks it against the pinned
// SHA-256. Usage: node scripts/fetch-model.mjs [--check]
// Honours HTTPS_PROXY / https_proxy by shelling out to curl (present on Windows 10+, macOS, Linux).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'assets');
const file = join(dir, 'pose_landmarker_lite.task');
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const expected = readFileSync(join(root, 'pose_landmarker_lite.task.sha256'), 'utf8').trim().split(/\s+/)[0];

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

if (existsSync(file) && sha(file) === expected) {
  console.log('pose_landmarker_lite.task is present and matches the pinned SHA-256.');
  process.exit(0);
}
if (process.argv.includes('--check')) {
  console.error('pose_landmarker_lite.task is missing or does not match the pinned SHA-256. Run: node scripts/fetch-model.mjs');
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
const tmp = `${file}.part`;
try {
  // --ssl-no-revoke: corporate proxies on Windows often cannot reach the revocation servers.
  const extra = process.platform === 'win32' ? ['--ssl-no-revoke'] : [];
  execFileSync('curl', ['-fSL', '--retry', '3', ...extra, '-o', tmp, url], { stdio: 'inherit' });
} catch (e) {
  rmSync(tmp, { force: true });
  console.error(`Download failed (${e.message}). Fetch ${url} by hand into assets/ and run with --check.`);
  process.exit(1);
}
const got = sha(tmp);
if (got !== expected) {
  rmSync(tmp, { force: true });
  console.error(`SHA-256 mismatch.\n  expected ${expected}\n  got      ${got}\nIf Google published a new model, review it and update pose_landmarker_lite.task.sha256 in a reviewed change.`);
  process.exit(1);
}
renameSync(tmp, file);
console.log('Downloaded and verified pose_landmarker_lite.task.');
