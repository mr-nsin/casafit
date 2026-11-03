#!/usr/bin/env node
// PLACEHOLDER BRAND ART generator. Not final artwork: a white house on the primary colour, from the splash design
// (project/m3-splash.dc.html). Pure node (zlib only), no dependencies. Run: node app/tools/make-icons.mjs
// Colours are copied from the light M3 tokens (--p, --op, --pc) and mirrored in app.json.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIMARY = [0x9c, 0x44, 0x00]; // --p
const ON_PRIMARY = [0xff, 0xff, 0xff]; // --op
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'brand');
mkdirSync(out, { recursive: true });

// Coverage tests in a unit square (0..1). House glyph, roughly Material "home".
const inPoly = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const ROOF = [[0.5, 0.12], [0.94, 0.5], [0.82, 0.5], [0.82, 0.86], [0.18, 0.86], [0.18, 0.5], [0.06, 0.5]];
const DOOR = [[0.42, 0.86], [0.42, 0.6], [0.58, 0.6], [0.58, 0.86]];
const house = (x, y) => inPoly(ROOF, x, y) && !inPoly(DOOR, x, y);
const squircle = (x, y) => {
  // superellipse, n=5, inset slightly
  const u = Math.abs(x - 0.5) / 0.5, v = Math.abs(y - 0.5) / 0.5;
  return u ** 5 + v ** 5 <= 1;
};

// shape(x,y) -> colour [r,g,b] or null. Renders SS x SS samples per pixel into RGBA.
function render(size, shape, ss = 3) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shape((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const o = (y * size + x) * 4;
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; px[o + 3] = (255 * a) / (ss * ss); }
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Scale the house into a centred box of `frac` of the canvas.
const scaled = (frac, test) => (x, y) => test((x - 0.5) / frac + 0.5, (y - 0.5) / frac + 0.5);

const files = {
  // iOS and store icon: opaque, full bleed, the OS applies the mask.
  'icon.png': [1024, (x, y) => (scaled(0.56, house)(x, y) ? ON_PRIMARY : PRIMARY)],
  // Android adaptive: transparent, glyph inside the central 66% safe zone (432 of 648 dp-scaled px).
  'adaptive-foreground.png': [1024, (x, y) => (scaled(0.5, house)(x, y) ? ON_PRIMARY : null)],
  'adaptive-monochrome.png': [1024, (x, y) => (scaled(0.5, house)(x, y) ? [0, 0, 0] : null)],
  // Splash: white squircle with a primary house, shown on the primary background colour.
  'splash.png': [1024, (x, y) => (!squircle(x, y) ? null : scaled(0.58, house)(x, y) ? PRIMARY : ON_PRIMARY)],
  'favicon.png': [196, (x, y) => (scaled(0.62, house)(x, y) ? ON_PRIMARY : PRIMARY)],
};
for (const [name, [size, shape]] of Object.entries(files)) {
  writeFileSync(join(out, name), png(size, render(size, shape, size > 512 ? 2 : 3)));
  console.log('wrote', join(out, name));
}
