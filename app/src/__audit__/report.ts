// Turns scenario results into app/audit-report.json (machine-readable) and docs/plans/ui-audit.md (readable),
// and compares findings with the allowlist of known issues.

import type { ControlResult, ScenarioResult, Severity } from './run';

export interface Finding {
  /** Stable id used by the allowlist: "Screen | control | issue". Variants are left out on purpose. */
  key: string;
  issue: string;
  severity: Severity;
  screen: string;
  variants: string[];
  control: string;
  via: string[];
  outcome: string;
  detail: string;
  cause: string | null;
  navProblems: string[];
  errors: string[];
}

export interface AllowEntry {
  key: string;
  note: string;
}

/**
 * Labels that change with the calendar must not change a finding's key, or the allowlist breaks at midnight.
 * "Fri, Walk" (a day chip) becomes "<weekday> day chip"; "7 September 2027" becomes "<date>".
 */
export function stableLabel(label: string): string {
  return label
    .replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,.*$/, '<weekday> day chip')
    .replace(/\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/g, '<date>');
}

/** The issue kinds a control can have. A control can have several. */
export function issuesOf(r: ControlResult): string[] {
  const out: string[] = [];
  if (r.outcome === 'crash') out.push('screen-crash');
  if (r.outcome === 'threw') out.push('press-throws');
  if (r.outcome === 'no-handler') out.push('no-handler');
  if (r.outcome === 'nothing') out.push(r.flags.includes('no-controls') ? 'no-controls' : 'nothing-happens');
  if (r.navProblems.length) out.push('bad-nav-target');
  if (r.errors.length && r.outcome !== 'threw' && r.outcome !== 'crash') out.push('console-error');
  if (r.flags.some((f) => f.startsWith('hit-area-under-44'))) out.push('hit-area-under-44');
  if (r.flags.includes('no-accessible-label')) out.push('no-accessible-label');
  if (r.flags.includes('disabled-no-hint')) out.push('disabled-no-hint');
  if (r.flags.includes('keyboard-swallows-first-tap')) out.push('keyboard-swallows-first-tap');
  if (r.flags.includes('no-exit')) out.push('no-exit');
  return out;
}

const SEVERITY_OF_ISSUE: Record<string, Severity> = {
  'screen-crash': 'broken',
  'press-throws': 'broken',
  'no-handler': 'broken',
  'bad-nav-target': 'broken',
  'nothing-happens': 'suspicious',
  'no-controls': 'suspicious',
  'console-error': 'suspicious',
  'hit-area-under-44': 'suspicious',
  'disabled-no-hint': 'suspicious',
  'no-accessible-label': 'ok-but-unlabelled',
  'keyboard-swallows-first-tap': 'broken',
  'no-exit': 'suspicious',
};

/** Issues that are listed in the report but never fail the suite, because they depend on state or are advice. */
export const ADVISORY = new Set(['disabled-no-hint', 'no-accessible-label']);

export function findingsOf(results: ScenarioResult[]): Finding[] {
  const map = new Map<string, Finding>();
  for (const s of results) {
    for (const r of s.controls) {
      for (const issue of issuesOf(r)) {
        const label = stableLabel(`${r.via.length ? r.via.join(' > ') + ' > ' : ''}${r.control}`);
        const key = `${r.screen} | ${label} | ${issue}`;
        const f = map.get(key);
        if (f) {
          if (!f.variants.includes(r.variant)) f.variants.push(r.variant);
          continue;
        }
        map.set(key, {
          key,
          issue,
          severity: SEVERITY_OF_ISSUE[issue] ?? 'suspicious',
          screen: r.screen,
          variants: [r.variant],
          control: r.control,
          via: r.via,
          outcome: r.outcome,
          detail: r.navProblems.join('; ') || r.errors[0] || r.detail,
          cause: r.cause,
          navProblems: r.navProblems,
          errors: r.errors,
        });
      }
    }
  }
  const rank: Record<Severity, number> = { broken: 0, suspicious: 1, 'ok-but-unlabelled': 2, ok: 3 };
  return [...map.values()].sort((a, b) => rank[a.severity] - rank[b.severity] || a.screen.localeCompare(b.screen) || a.control.localeCompare(b.control));
}

export function newFindings(findings: Finding[], allow: AllowEntry[]): Finding[] {
  const known = new Set(allow.map((a) => a.key));
  return findings.filter((f) => !ADVISORY.has(f.issue) && !known.has(f.key));
}

export function staleAllowEntries(findings: Finding[], allow: AllowEntry[]): AllowEntry[] {
  const keys = new Set(findings.map((f) => f.key));
  return allow.filter((a) => !keys.has(a.key));
}

export interface Summary {
  screens: number;
  scenarios: number;
  controls: number;
  pressed: number;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  findingsByIssue: Record<string, number>;
}

export function summarise(results: ScenarioResult[], findings: Finding[]): Summary {
  const bySeverity: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  let controls = 0;
  let pressed = 0;
  for (const s of results) {
    for (const r of s.controls) {
      if (r.kind === 'screen') continue;
      controls += 1;
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
      byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
      if (!['disabled', 'skipped-hidden', 'no-handler'].includes(r.outcome)) pressed += 1;
    }
  }
  const findingsByIssue: Record<string, number> = {};
  for (const f of findings) findingsByIssue[f.issue] = (findingsByIssue[f.issue] ?? 0) + 1;
  return { screens: new Set(results.map((r) => r.screen)).size, scenarios: results.length, controls, pressed, bySeverity, byOutcome, findingsByIssue };
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(results: ScenarioResult[], findings: Finding[], allow: AllowEntry[], date: string, notAudited: string[]): string {
  const sum = summarise(results, findings);
  const L: string[] = [];
  L.push('# UI audit: tap every control');
  L.push('');
  L.push(`Generated ${date} by \`npm run audit\` (\`app/src/__audit__\`). Machine-readable copy: \`app/audit-report.json\`. Known issues live in \`app/src/__audit__/allowlist.json\`; a finding that is not listed there fails the audit test.`);
  L.push('');
  L.push('## How it works');
  L.push('');
  L.push('Each screen is rendered on its own in Jest with the same wiring as `bootstrap` (real database on SQLite, real stores, fakes for network, camera, purchases, step counter, notifications). Every pressable (buttons, rows, chips, tabs, switches, accessibility actions, text fields) is found in the rendered tree and pressed on a fresh copy of the screen. After each press the audit looks for: a navigation call, a store change, a changed screen, an opened overlay, a call into a dependency (database write, API, share, link), or an error. A press that does none of these is reported. Controls that open a sheet or dialog, or reveal new controls, are followed one level and their controls are pressed too.');
  L.push('');
  L.push('Severity: **broken** (no handler, throws, screen crash, navigates to a route that is not registered or needs a param it did not get), **suspicious** (press changes nothing observable, console errors, hit area under 44 px, no controls on a screen), **ok-but-unlabelled** (works, but a screen reader has no name for it).');
  L.push('');
  L.push('Limits: Jest cannot see layout, so hit areas are only checked where a size is written in the style. It cannot feel gestures, native prompts or the camera (see "Needs device"). A "nothing happens" result can be a false alarm when the press is meant to be a no-op in that state; check the cause line.');
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push(`- Routes covered: ${sum.screens} (${sum.scenarios} screen states)`);
  L.push(`- Controls found: ${sum.controls}; pressed: ${sum.pressed}`);
  L.push(`- Findings (distinct screen, control and issue): ${findings.length}`);
  L.push(`- By severity (control results): ${Object.entries(sum.bySeverity).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  L.push(`- By outcome: ${Object.entries(sum.byOutcome).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  L.push(`- Findings by issue: ${Object.entries(sum.findingsByIssue).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  L.push('');

  const section = (title: string, sev: Severity, pick: (f: Finding) => boolean = () => true) => {
    const rows = findings.filter((f) => f.severity === sev && pick(f));
    L.push(`## ${title} (${rows.length})`);
    L.push('');
    if (!rows.length) {
      L.push('None.');
      L.push('');
      return;
    }
    L.push('| Screen | Control | Issue | Seen in | Detail | Likely cause |');
    L.push('|---|---|---|---|---|---|');
    for (const f of rows) {
      const ctl = (f.via.length ? `${f.via.join(' > ')} > ` : '') + f.control;
      L.push(`| ${cell(f.screen)} | ${cell(ctl)} | ${f.issue} | ${cell(f.variants.join('; '))} | ${cell(f.detail.slice(0, 160))} | ${f.cause ? '`' + f.cause + '`' : 'unknown'} |`);
    }
    L.push('');
  };
  section('Broken', 'broken');
  section('Suspicious', 'suspicious', (f) => f.issue !== 'disabled-no-hint');
  section('Disabled with no explanation (review: usually correct for that state)', 'suspicious', (f) => f.issue === 'disabled-no-hint');
  section('Works but has no accessible name', 'ok-but-unlabelled');

  L.push('## Coverage by screen');
  L.push('');
  L.push('| Screen | States | Controls | Pressed | Broken | Suspicious | Unlabelled |');
  L.push('|---|---|---|---|---|---|---|');
  const byScreen = new Map<string, ScenarioResult[]>();
  for (const r of results) byScreen.set(r.screen, [...(byScreen.get(r.screen) ?? []), r]);
  for (const [screen, rs] of byScreen) {
    const ctl = rs.flatMap((r) => r.controls).filter((c) => c.kind !== 'screen');
    const pressed = ctl.filter((c) => !['disabled', 'skipped-hidden', 'no-handler'].includes(c.outcome)).length;
    const fs = findings.filter((f) => f.screen === screen);
    L.push(`| ${screen} | ${rs.map((r) => r.variant).join('; ')} | ${ctl.length} | ${pressed} | ${fs.filter((f) => f.severity === 'broken').length} | ${fs.filter((f) => f.severity === 'suspicious').length} | ${fs.filter((f) => f.severity === 'ok-but-unlabelled').length} |`);
  }
  L.push('');

  L.push('## Needs device (hand to the Maestro pass)');
  L.push('');
  L.push('Jest cannot judge these. Check each on the emulator or a phone.');
  L.push('');
  const dev = new Map<string, Set<string>>();
  for (const r of results) for (const d of r.needsDevice) dev.set(d, (dev.get(d) ?? new Set()).add(r.screen));
  for (const [d, scr] of dev) L.push(`- ${d} (${[...scr].join(', ')})`);
  for (const d of GENERAL_NEEDS_DEVICE) L.push(`- ${d}`);
  L.push('');

  L.push('## Not audited, and why');
  L.push('');
  for (const n of notAudited) L.push(`- ${n}`);
  L.push('');

  L.push('## Known issues (allowlist)');
  L.push('');
  L.push(`${allow.length} entries in \`app/src/__audit__/allowlist.json\`. Remove an entry when its control is fixed; the audit prints entries that no longer match.`);
  L.push('');
  return L.join('\n');
}

export const GENERAL_NEEDS_DEVICE = [
  'Drag to reorder moves in the Editor (gesture-handler pan on the drag handle; the up and down buttons are audited)',
  'Scrolling, pull to refresh, swipe-back and the Android back button',
  'Real hit areas, overlap and anything off screen (Jest has no layout)',
  'Keyboard: opening, autofocus on the code boxes, "next" and "done" keys, screen resize',
  'Bottom tab bar taps and tab state (rendered by React Navigation, outside the screens)',
  'Status bar colour, safe areas, notches',
  'Sound, haptics, keep-awake, notifications arriving',
  'Dark theme and font scaling',
];
