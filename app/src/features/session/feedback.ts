// Plain-language feedback for the Player controls that change the plan "from the next set"
// (Easier / Harder) or stretch a rest (+15s / +30s). Pure: screens show the text and announce it.

import { locate } from './locate';
import { MAX_EXTRA_REST_MS, type AddRestResult, type SessionState } from './store';
import { effOf, positionAt } from './view';

const secs = (ms: number): number => Math.round(ms / 1000);

/**
 * Says what a new intensity does, once the store has applied it. `unit` is "move", "pose" or
 * "step". The change only ever reaches sets that have not started, so name the first one.
 */
export function rungNotice(s: SessionState, now: number, label: string, unit: string): string {
  if (!s.plan || !s.timeline) return `${label} selected.`;
  const eff = effOf(s);
  const loc = locate(eff, positionAt(s, now));
  if (!loc) return `${label} selected.`;
  const cutStep = loc.seg.stepIndex;
  const cutSet = loc.seg.set;
  const hit = eff.find((e) => {
    const st = s.plan!.steps[e.seg.stepIndex];
    return e.seg.kind === 'work' && st?.phase === 'work' && (e.seg.stepIndex > cutStep || (e.seg.stepIndex === cutStep && e.seg.set > cutSet));
  });
  if (!hit) return `${label} selected. No sets are left to change in this session.`;
  const next = s.plan.steps[hit.seg.stepIndex]!;
  const work = `${secs(hit.endMs - hit.startMs)} s of work`;
  if (hit.seg.stepIndex === cutStep) return `${label} from the next set: ${next.name}, ${work}.`;
  const cur = s.plan.steps[cutStep];
  if (cur?.phase === 'work') return `${label} from the next ${unit}: ${next.name}, ${work}.`;
  return `${label} from ${next.name}, ${work}.`;
}

/** What +15s / +30s just did. */
export function restNotice(r: AddRestResult): string {
  if (!r.ok) {
    if (r.reason === 'max') return `That rest already has the most extra time (${secs(MAX_EXTRA_REST_MS)} s).`;
    return 'There is no rest left to extend in this session.';
  }
  const added = secs(r.addedMs);
  const whole = secs(r.restMs);
  const cap = r.capped ? ` That is the most extra rest (${secs(MAX_EXTRA_REST_MS)} s).` : '';
  if (r.where === 'current') return `Rest extended: +${added}s, now ${whole}s.${cap}`;
  return `Added to your next rest, after ${r.after}: +${added}s, now ${whole}s.${cap}`;
}
