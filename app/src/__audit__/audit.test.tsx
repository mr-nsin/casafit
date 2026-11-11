// The tap-every-control audit (about five minutes, so jest.config.js skips it unless AUDIT_RUN=1; `npm run audit` sets it).
// Known issues are in allowlist.json, so only a new problem fails it. `npm run audit` also writes
// app/audit-report.json and docs/plans/ui-audit.md.
//   AUDIT_ONLY=<regex>        run only the scenarios whose id matches (no report, no allowlist check)
//   AUDIT_WRITE=1             write the report files
//   AUDIT_UPDATE_ALLOWLIST=1  rewrite allowlist.json from the current findings (keeps existing notes)

import { newFindings, findingsOf, staleAllowEntries, summarise, toMarkdown, type AllowEntry } from './report';
import { runScenario, type ScenarioResult } from './run';
import { scenarios } from './scenarios';
import allowlist from './allowlist.json';

jest.mock('@react-navigation/native', () => require('./navMock').navigationModule);
jest.mock('../ui/useMotion', () => require('./motionMock').motionModule());
// No native gesture root under Jest: the detector passes its child through (drag is listed under "needs device").
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePanGesture: () => ({}),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

declare const __dirname: string;
declare const process: { env: Record<string, string | undefined> };

const only = process.env.AUDIT_ONLY ? new RegExp(process.env.AUDIT_ONLY, 'i') : null;
const results: ScenarioResult[] = [];

describe('tap-every-control audit', () => {
  for (const s of scenarios) {
    if (only && !only.test(s.id)) continue;
    it(s.id, async () => {
      const r = await runScenario(s);
      results.push(r);
      // A screen that does not render at all is the loudest failure; the allowlist check below reports it by name.
      expect(r.screen).toBe(s.screen);
    }, 240_000);
  }

  it('reports, and fails only for problems that are not in the allowlist', () => {
    if (only) {
      const lines = results.flatMap((r) => [
        `## ${r.scenario}: ${r.controlCount} controls${r.noisy ? ' (noisy)' : ''}${r.renderError ? ' RENDER ERROR ' + r.renderError : ''} ${r.ms}ms`,
        ...r.controls.map((c) => `  ${c.via.length ? c.via.join('>') + '>' : ''}${c.control} [${c.role}] -> ${c.outcome}/${c.severity} ${c.signals.join(',')} ${c.navCalls.join(' ')} ${c.effects.join(',')} ${c.flags.join(',')} ${c.errors[0] ?? ''} ${c.cause ?? ''}`),
      ]);
      console.log(lines.join('\n'));
      return;
    }
    const fs = require('fs');
    const path = require('path');
    const appRoot = path.resolve(__dirname, '../..');
    const findings = findingsOf(results);
    const allow = allowlist as AllowEntry[];
    const date = new Date().toISOString().slice(0, 10);

    if (process.env.AUDIT_UPDATE_ALLOWLIST) {
      const notes = new Map(allow.map((a) => [a.key, a.note]));
      const next = newFindings(findings, []).map((f) => ({ key: f.key, note: notes.get(f.key) ?? `Known on first audit, ${date}. ${f.cause ? 'See ' + f.cause + '.' : ''}`.trim() }));
      fs.writeFileSync(path.join(__dirname, 'allowlist.json'), JSON.stringify(next, null, 2) + '\n');
    }

    if (process.env.AUDIT_WRITE) {
      const notAudited = NOT_AUDITED;
      const summary = summarise(results, findings);
      // Summary and findings are indented for reading; the per-control detail is one scenario per line to keep the file small.
      const head = {
        generated: date,
        summary,
        findings,
        needsDevice: [...new Set(results.flatMap((r) => r.needsDevice.map((d) => `${r.screen}: ${d}`)))],
        notAudited,
      };
      const scenarioLines = results.map((r) => JSON.stringify({ scenario: r.scenario, screen: r.screen, variant: r.variant, controlCount: r.controlCount, noisy: r.noisy, renderError: r.renderError, controls: r.controls }));
      const headText = JSON.stringify(head, null, 2).replace(/\n}$/, '');
      const body = scenarioLines.map((l) => '    ' + l).join(',\n');
      fs.writeFileSync(path.join(appRoot, 'audit-report.json'), `${headText},\n  "scenarios": [\n${body}\n  ]\n}\n`);
      fs.writeFileSync(path.join(appRoot, '..', 'docs', 'plans', 'ui-audit.md'), toMarkdown(results, findings, allow, date, notAudited) + '\n');
    }

    const stale = staleAllowEntries(findings, allow);
    if (stale.length) console.log(`Allowlist entries that no longer match (fixed? remove them):\n${stale.map((s) => '  ' + s.key).join('\n')}`);
    const fresh = newFindings(findings, allow);
    expect(fresh.map((f) => `${f.severity}: ${f.key}${f.cause ? ` (${f.cause})` : ''}: ${f.detail}`)).toEqual([]);
  }, 60_000);
});

const NOT_AUDITED = [
  'Splash has no controls and leaves by itself on a timer. Building runs a build on a timer and navigates by itself; only its one button is pressed.',
  'Tab bar buttons and the native-stack header: owned by React Navigation, not by a screen. Maestro covers them.',
  'Drag-to-reorder in the Editor: a native gesture. The up and down buttons are pressed.',
  'Anything behind a native prompt (camera, Health Connect, notifications, store purchase sheet, Google or Apple sign-in): the audit presses the button and checks the app asks, but cannot answer the prompt.',
  'Screens reached only through a state the seed cannot reach (for example a live pose stream with real landmarks).',
];
