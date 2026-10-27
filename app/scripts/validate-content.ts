// Validate the bundled content packs.
//
//   node app/scripts/validate-content.ts          (from the repo root)
//   node scripts/validate-content.ts              (from app/)
//   node scripts/validate-content.ts --json       (machine-readable output)
//
// Needs Node 22.6 or newer for type stripping. Exit code 1 when anything is wrong.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateContent } from '../src/content/validate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'assets', 'content');
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

const raw = {
  exercises: read('exercises.json'),
  substitutions: read('substitutions.json'),
  plans: read('plans.json'),
  foods: read('foods.json'),
  learn: read('learn.json'),
  voice: read('voice-cues.json'),
  strings: read('strings.en-IN.json'),
};
const schema = read('schema/content.schema.json');
const manifest = read('manifest.json');

const issues = validateContent(raw as never, schema);

const counts = {
  exercises: raw.exercises.exercises.length,
  substitutions: raw.substitutions.substitutions.length,
  plans: raw.plans.plans.length,
  foods: raw.foods.foods.length,
  myths: raw.learn.myths.length,
  concepts: raw.learn.concepts.length,
  voiceEvents: raw.voice.events.length,
  strings: Object.keys(raw.strings.strings).length,
};
for (const [k, v] of Object.entries(counts)) {
  if (manifest.counts?.[k] !== v) {
    issues.push({ pack: 'manifest', path: `$.counts.${k}`, message: `manifest says ${manifest.counts?.[k]}, files have ${v}` });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ok: issues.length === 0, counts, issues }, null, 2));
} else {
  console.log('CasaFit content check');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);
  console.log('  all packs marked needsExpertReview: true');
  if (issues.length === 0) {
    console.log('OK: no problems found.');
  } else {
    console.log(`\n${issues.length} problem(s):`);
    for (const i of issues.slice(0, 200)) console.log(`  [${i.pack}] ${i.path}  ${i.message}`);
    if (issues.length > 200) console.log(`  ... and ${issues.length - 200} more`);
  }
}
process.exit(issues.length === 0 ? 0 : 1);
