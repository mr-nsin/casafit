// Synthetic stick-figure landmark sequences. Used by the engine tests and by the dev-only
// simulated pose source. No device, no camera, no recorded person. Side-on figure facing right.

import { LM } from './engine';
import type { FormExercise, Landmark, PoseFrame } from './types';

export interface SynthOpts {
  /** Frames per second (default 15). */
  hz?: number;
  /** Standing or holding still before the first rep (default 1200 ms). */
  leadInMs?: number;
  /** Standing after the last rep (default 800 ms). */
  tailMs?: number;
  /** Scales the whole figure about the frame centre. 0.3 makes it too small. */
  scale?: number;
  /** Position noise in frame units (default 0). Deterministic. */
  noise?: number;
  /** Windows (ms from the first frame) where every landmark is hidden. */
  dropouts?: { fromMs: number; toMs: number }[];
  t0?: number;
}

type Pt = [number, number];
type Fig = Partial<Record<number, Pt>>;

const R = (i: number) => i + 1;

function rot([x, y]: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

/** Builds the 33-landmark array: unset points sit at the nose so nothing is NaN. */
function frameOf(fig: Fig, t: number, o: SynthOpts, rand: () => number, hidden: boolean): PoseFrame {
  const scale = o.scale ?? 1;
  const noise = o.noise ?? 0;
  const fallback = fig[LM.NOSE] ?? [0.5, 0.5];
  const lm: Landmark[] = [];
  for (let i = 0; i < 33; i++) {
    const p = fig[i] ?? fallback;
    lm.push({
      x: 0.5 + (p[0] - 0.5) * scale + noise * rand(),
      y: 0.55 + (p[1] - 0.55) * scale + noise * rand(),
      v: hidden ? 0.05 : 0.99,
    });
  }
  return { t, lm };
}

function build(duration: number, figAt: (tMs: number) => Fig, o: SynthOpts, seed = 7): PoseFrame[] {
  const hz = o.hz ?? 15;
  const t0 = o.t0 ?? 1000;
  const rand = lcg(seed);
  const out: PoseFrame[] = [];
  for (let ms = 0; ms <= duration; ms += 1000 / hz) {
    const hidden = (o.dropouts ?? []).some((d) => ms >= d.fromMs && ms < d.toMs);
    out.push(frameOf(figAt(ms), t0 + ms, o, rand, hidden));
  }
  return out;
}

/** 0 at the start of a rep, 1 at the deepest point, 0 at the end. */
const wave = (u: number): number => 0.5 - 0.5 * Math.cos(2 * Math.PI * u);

function repPhase(ms: number, o: { leadInMs: number; repMs: number; reps: number }): number {
  const x = ms - o.leadInMs;
  if (x < 0 || x >= o.repMs * o.reps) return 0;
  return wave((x % o.repMs) / o.repMs);
}

// --- Squat ---------------------------------------------------------------------------------

function squatFig(knee: number, lean: number): Fig {
  const shin = 0.2;
  const thigh = 0.22;
  const torso = 0.3;
  const ankle: Pt = [0.5, 0.88];
  const phi = (180 - knee) * 0.15;
  const kn: Pt = [ankle[0] + shin * Math.sin((phi * Math.PI) / 180), ankle[1] - shin * Math.cos((phi * Math.PI) / 180)];
  const toAnkle: Pt = [ankle[0] - kn[0], ankle[1] - kn[1]];
  const len = Math.hypot(toAnkle[0], toAnkle[1]);
  const d: Pt = [toAnkle[0] / len, toAnkle[1] / len];
  const a = rot(d, knee);
  const b = rot(d, -knee);
  const dir = a[0] < b[0] ? a : b; // the hip goes back, behind the knee
  const hip: Pt = [kn[0] + thigh * dir[0], kn[1] + thigh * dir[1]];
  const sh: Pt = [hip[0] + torso * Math.sin((lean * Math.PI) / 180), hip[1] - torso * Math.cos((lean * Math.PI) / 180)];
  const nose: Pt = [sh[0] + 0.04, sh[1] - 0.08];
  const both = (base: number, p: Pt): Fig => ({ [base]: p, [R(base)]: [p[0] + 0.004, p[1]] });
  return {
    [LM.NOSE]: nose,
    ...both(LM.SHOULDER, sh),
    ...both(LM.ELBOW, [sh[0] + 0.05, sh[1] + 0.12]),
    ...both(LM.WRIST, [sh[0] + 0.12, sh[1] + 0.1]),
    ...both(LM.HIP, hip),
    ...both(LM.KNEE, kn),
    ...both(LM.ANKLE, ankle),
    ...both(LM.HEEL, [ankle[0] - 0.02, ankle[1] + 0.015]),
    ...both(LM.FOOT, [ankle[0] + 0.06, ankle[1] + 0.02]),
  };
}

export function squatSequence(o: SynthOpts & { reps?: number; minKnee?: number; lean?: number; repMs?: number } = {}): PoseFrame[] {
  const reps = o.reps ?? 5;
  const minKnee = o.minKnee ?? 85;
  const leanMax = o.lean ?? 30;
  const repMs = o.repMs ?? 2400;
  const leadInMs = o.leadInMs ?? 1200;
  const total = leadInMs + reps * repMs + (o.tailMs ?? 800);
  return build(total, (ms) => {
    const w = repPhase(ms, { leadInMs, repMs, reps });
    return squatFig(172 - (172 - minKnee) * w, leanMax * w);
  }, o);
}

// --- Push-up -------------------------------------------------------------------------------

function pushUpFig(elbow: number, sag: number): Fig {
  const arm = 0.12;
  const body = 0.58;
  const wrist: Pt = [0.7, 0.8];
  const d = 2 * arm * Math.sin(((elbow / 2) * Math.PI) / 180);
  const sh: Pt = [wrist[0], wrist[1] - d];
  const dx = Math.sqrt(Math.max(0, body * body - d * d));
  const ankle: Pt = [sh[0] - dx, wrist[1]];
  const hip: Pt = [(sh[0] + ankle[0]) / 2, (sh[1] + ankle[1]) / 2 + sag];
  const h = arm * Math.cos(((elbow / 2) * Math.PI) / 180);
  const el: Pt = [wrist[0] - h, wrist[1] - d / 2];
  const both = (base: number, p: Pt): Fig => ({ [base]: p, [R(base)]: [p[0] + 0.004, p[1]] });
  return {
    [LM.NOSE]: [sh[0] + 0.07, sh[1] - 0.02],
    ...both(LM.SHOULDER, sh),
    ...both(LM.ELBOW, el),
    ...both(LM.WRIST, wrist),
    ...both(LM.HIP, hip),
    ...both(LM.KNEE, [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2]),
    ...both(LM.ANKLE, ankle),
    ...both(LM.HEEL, [ankle[0] - 0.02, ankle[1]]),
    ...both(LM.FOOT, [ankle[0] - 0.05, ankle[1]]),
  };
}

export function pushUpSequence(o: SynthOpts & { reps?: number; minElbow?: number; sag?: number; repMs?: number } = {}): PoseFrame[] {
  const reps = o.reps ?? 5;
  const minElbow = o.minElbow ?? 80;
  const repMs = o.repMs ?? 2000;
  const leadInMs = o.leadInMs ?? 1200;
  const total = leadInMs + reps * repMs + (o.tailMs ?? 800);
  return build(total, (ms) => {
    const w = repPhase(ms, { leadInMs, repMs, reps });
    return pushUpFig(172 - (172 - minElbow) * w, (o.sag ?? 0) * Math.min(1, w * 3));
  }, o);
}

// --- Plank ---------------------------------------------------------------------------------

function plankFig(sag: number): Fig {
  const ankle: Pt = [0.15, 0.8];
  const sh: Pt = [0.7, 0.6];
  const hip: Pt = [(ankle[0] + sh[0]) / 2, (ankle[1] + sh[1]) / 2 + sag];
  const both = (base: number, p: Pt): Fig => ({ [base]: p, [R(base)]: [p[0] + 0.004, p[1]] });
  return {
    [LM.NOSE]: [0.77, 0.58],
    ...both(LM.SHOULDER, sh),
    ...both(LM.ELBOW, [0.7, 0.8]),
    ...both(LM.WRIST, [0.85, 0.8]),
    ...both(LM.HIP, hip),
    ...both(LM.KNEE, [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2]),
    ...both(LM.ANKLE, ankle),
    ...both(LM.HEEL, [ankle[0] - 0.02, ankle[1]]),
    ...both(LM.FOOT, [ankle[0] - 0.05, ankle[1]]),
  };
}

export function plankSequence(o: SynthOpts & { seconds?: number; sag?: number } = {}): PoseFrame[] {
  const seconds = o.seconds ?? 12;
  return build((o.leadInMs ?? 0) + seconds * 1000, () => plankFig(o.sag ?? 0), o);
}

// --- Lunge ---------------------------------------------------------------------------------

function lungeFig(knee: number, swap: boolean, trunk: number): Fig {
  const leg = 0.2;
  const dxAnkle = 0.18;
  const ankleY = 0.9;
  const dd = 2 * leg * Math.sin(((knee / 2) * Math.PI) / 180);
  const vert = Math.sqrt(Math.max(0.0001, dd * dd - dxAnkle * dxAnkle));
  const hip: Pt = [0.5, ankleY - vert];
  const h = leg * Math.cos(((knee / 2) * Math.PI) / 180);
  const legOf = (ankleX: number, forward: boolean) => {
    const ankle: Pt = [ankleX, ankleY];
    const m: Pt = [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2];
    const v: Pt = [ankle[0] - hip[0], ankle[1] - hip[1]];
    const n = Math.hypot(v[0], v[1]);
    let perp: Pt = [v[1] / n, -v[0] / n];
    if (forward ? perp[0] < 0 : perp[1] < 0) perp = [-perp[0], -perp[1]];
    return { ankle, knee: [m[0] + h * perp[0], m[1] + h * perp[1]] as Pt };
  };
  const front = legOf(0.5 + dxAnkle, true);
  const rear = legOf(0.5 - dxAnkle, false);
  const sh: Pt = [hip[0] + 0.3 * Math.sin((trunk * Math.PI) / 180), hip[1] - 0.3 * Math.cos((trunk * Math.PI) / 180)];
  const [fBase, rBase] = swap ? [1, 0] : [0, 1];
  const foot = (a: Pt): Pt => [a[0] + 0.06, a[1] + 0.02];
  return {
    [LM.NOSE]: [sh[0] + 0.04, sh[1] - 0.08],
    [LM.SHOULDER]: sh,
    [LM.SHOULDER + 1]: [sh[0] + 0.004, sh[1]],
    [LM.HIP]: hip,
    [LM.HIP + 1]: [hip[0] + 0.004, hip[1]],
    [LM.KNEE + fBase]: front.knee,
    [LM.KNEE + rBase]: rear.knee,
    [LM.ANKLE + fBase]: front.ankle,
    [LM.ANKLE + rBase]: rear.ankle,
    [LM.HEEL + fBase]: [front.ankle[0] - 0.02, front.ankle[1] + 0.015],
    [LM.HEEL + rBase]: [rear.ankle[0] - 0.02, rear.ankle[1] + 0.015],
    [LM.FOOT + fBase]: foot(front.ankle),
    [LM.FOOT + rBase]: foot(rear.ankle),
  };
}

export function lungeSequence(
  o: SynthOpts & { reps?: number; minKnee?: number; trunk?: number; repMs?: number; alternate?: boolean } = {},
): PoseFrame[] {
  const reps = o.reps ?? 5;
  const minKnee = o.minKnee ?? 88;
  const repMs = o.repMs ?? 2600;
  const leadInMs = o.leadInMs ?? 1200;
  const total = leadInMs + reps * repMs + (o.tailMs ?? 800);
  return build(total, (ms) => {
    const w = repPhase(ms, { leadInMs, repMs, reps });
    const idx = Math.floor((ms - leadInMs) / repMs);
    return lungeFig(172 - (172 - minKnee) * w, !!o.alternate && idx % 2 === 1, (o.trunk ?? 5) * w);
  }, o);
}

/** A clean demo set for the dev-only simulated source. */
export function demoSequence(exercise: FormExercise): PoseFrame[] {
  switch (exercise) {
    case 'squat':
      return squatSequence({ reps: 5 });
    case 'push_up':
      return pushUpSequence({ reps: 5 });
    case 'plank':
      return plankSequence({ seconds: 14 });
    case 'lunge':
      return lungeSequence({ reps: 5 });
  }
}
