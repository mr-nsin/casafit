// Rep and hold engine for the four form-check exercises. Pure TypeScript (docs/plans/spikes/pose.md
// sections 3 to 5): landmarks in, events out. No worklet, native or React imports. Nothing here
// keeps more than the current smoothed frame, a three-angle window and per-rep aggregates, and
// reset() drops all of it.

import { angleAt, dist, fromHorizontal, fromVertical, median3, type Pt } from './geometry';
import { OneEuro, type OneEuroConfig } from './oneEuro';
import {
  COUNT_HOLD_MS,
  COUNT_REPS,
  type Engine,
  type EngineEvent,
  type EngineFinding,
  type EngineSummary,
  type FormExercise,
  type FramingHint,
  type Issue,
  type PoseFrame,
  type Rating,
} from './types';

/** MediaPipe landmark bases. The right side is the left index plus one. */
export const LM = { NOSE: 0, SHOULDER: 11, ELBOW: 13, WRIST: 15, HIP: 23, KNEE: 25, ANKLE: 27, HEEL: 29, FOOT: 31 } as const;
type Side = 0 | 1;

export interface EngineConfig {
  smoothing: OneEuroConfig;
  /** A landmark is usable at or above this visibility. */
  minVisibility: number;
  /** Soft floor for heels and feet, which are optional inputs. */
  feetVisibility: number;
  /** Invalid for this long: show "lost framing" and drop the rep in flight. */
  lostAfterMs: number;
  /** Invalid for this long: counting pauses until `resumeFrames` valid frames in a row. */
  pauseAfterMs: number;
  resumeFrames: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  // The spike's beta (0.05) was written for pixels; coordinates here are normalised, so speeds are
  // about 100x smaller and beta is scaled to match. Tune on real footage.
  smoothing: { minCutoff: 1.0, beta: 5, dCutoff: 1.0 },
  minVisibility: 0.5,
  feetVisibility: 0.35,
  lostAfterMs: 1000,
  pauseAfterMs: 5000,
  resumeFrames: 10,
};

interface Ctx {
  p(i: number): Pt;
  vis(i: number): number;
  side: Side;
  t: number;
  /** +1 when the person faces right in the image, -1 when left. */
  facing: 1 | -1;
  torso: number;
}

const at = (base: number, side: Side): number => base + side;

/** Required landmarks per exercise for one working side (spike section 3, common). */
function requiredFor(exercise: FormExercise, side: Side): number[] {
  switch (exercise) {
    case 'squat':
      return [at(LM.SHOULDER, side), at(LM.HIP, side), at(LM.KNEE, side), at(LM.ANKLE, side)];
    case 'lunge':
      // Both legs are needed to tell the front leg from the back one.
      return [at(LM.SHOULDER, side), LM.HIP, LM.HIP + 1, LM.KNEE, LM.KNEE + 1, LM.ANKLE, LM.ANKLE + 1];
    case 'push_up':
    case 'plank':
      return [at(LM.SHOULDER, side), at(LM.ELBOW, side), at(LM.WRIST, side), at(LM.HIP, side), at(LM.ANKLE, side)];
  }
}

export interface Framing {
  ok: boolean;
  hint?: Extract<FramingHint, 'closer' | 'back'>;
  /** Mean visibility of the required landmarks, 0..1. */
  confidence: number;
}

const finiteLm = (l: { x: number; y: number; v: number } | undefined): boolean =>
  !!l && Number.isFinite(l.x) && Number.isFinite(l.y) && Number.isFinite(l.v);

function framingOf(frame: PoseFrame, ids: number[], side: Side, confidence: number): Framing {
  const aspect = (frame.w ?? 1) / (frame.h ?? 1);
  const sh = frame.lm[at(LM.SHOULDER, side)]!;
  const hp = frame.lm[at(LM.HIP, side)]!;
  const torso = Math.hypot((sh.x - hp.x) * aspect, sh.y - hp.y);
  if (torso < 0.12) return { ok: false, hint: 'closer', confidence };
  const edge = 0.02;
  for (const i of ids) {
    const l = frame.lm[i]!;
    if (l.x < edge || l.x > 1 - edge || l.y < edge || l.y > 1 - edge) return { ok: false, hint: 'back', confidence };
  }
  return { ok: true, confidence };
}

/** Free framing check for the preview: no counting, no state. */
export function evaluateFraming(frame: PoseFrame, exercise: FormExercise): Framing {
  const score = (s: Side) => {
    const ids = requiredFor(exercise, s);
    return ids.reduce((a, i) => a + (frame.lm[i]?.v ?? 0), 0) / ids.length;
  };
  const side: Side = score(1) > score(0) + 0.1 ? 1 : 0;
  const ids = requiredFor(exercise, side);
  const confidence = score(side);
  if (!ids.every((i) => finiteLm(frame.lm[i]) && frame.lm[i]!.v >= DEFAULT_ENGINE_CONFIG.minVisibility)) {
    return { ok: false, hint: 'back', confidence };
  }
  return framingOf(frame, ids, side, confidence);
}

const ratingOf = (share: number, good: number, okay: number): Rating => (share >= good ? 'good' : share >= okay ? 'okay' : 'needs_work');

abstract class BaseEngine implements Engine {
  protected readonly cfg: EngineConfig;
  private filters: { x: OneEuro; y: OneEuro }[] = [];
  private pts: Pt[] = [];
  private rawVis: number[] = new Array(33).fill(0);
  private raw: PoseFrame | null = null;
  private side: Side = 0;
  private sideT: number | null = null;
  private facing: 1 | -1 = 1;
  private invalidSince: number | null = null;
  private paused = false;
  private validStreak = 0;
  private framingKey: string | null = null;
  protected lastT: number | null = null;

  constructor(
    readonly exercise: FormExercise,
    cfg?: Partial<EngineConfig>,
  ) {
    this.cfg = { ...DEFAULT_ENGINE_CONFIG, ...cfg };
  }

  protected abstract step(c: Ctx, events: EngineEvent[]): void;
  protected abstract discardInFlight(events: EngineEvent[]): void;
  protected abstract clear(): void;
  abstract summary(): EngineSummary;

  private ingest(frame: PoseFrame): void {
    const tSec = frame.t / 1000;
    const aspect = (frame.w ?? 1) / (frame.h ?? 1);
    for (let i = 0; i < 33; i++) {
      const l = frame.lm[i];
      if (!finiteLm(l)) {
        this.rawVis[i] = 0;
        continue;
      }
      this.rawVis[i] = l!.v;
      if (!this.filters[i]) this.filters[i] = { x: new OneEuro(this.cfg.smoothing), y: new OneEuro(this.cfg.smoothing) };
      if (l!.v >= this.cfg.feetVisibility) {
        this.pts[i] = { x: this.filters[i]!.x.filter(l!.x * aspect, tSec), y: this.filters[i]!.y.filter(l!.y, tSec) };
      } else if (!this.pts[i]) {
        this.pts[i] = { x: l!.x * aspect, y: l!.y };
      }
    }
    this.raw = frame;
  }

  private score(side: Side): number {
    const ids = requiredFor(this.exercise, side);
    return ids.reduce((a, i) => a + this.rawVis[i]!, 0) / ids.length;
  }

  /** Working side: best mean visibility, re-checked every 2 s with 0.1 hysteresis. */
  private pickSide(t: number): void {
    if (this.sideT === null) {
      this.side = this.score(1) > this.score(0) ? 1 : 0;
      this.sideT = t;
    } else if (t - this.sideT >= 2000) {
      const other: Side = this.side === 0 ? 1 : 0;
      if (this.score(other) > this.score(this.side) + 0.1) this.side = other;
      this.sideT = t;
    }
  }

  private emitFraming(key: string, ev: EngineEvent, events: EngineEvent[]): void {
    if (this.framingKey === key) return;
    this.framingKey = key;
    events.push(ev);
  }

  push(frame: PoseFrame): EngineEvent[] {
    const events: EngineEvent[] = [];
    if (!Number.isFinite(frame.t) || (this.lastT !== null && frame.t < this.lastT)) return events;
    this.ingest(frame);
    this.pickSide(frame.t);
    const ids = requiredFor(this.exercise, this.side);
    const valid = ids.every((i) => this.rawVis[i]! >= this.cfg.minVisibility && this.pts[i] !== undefined);

    if (!valid) {
      // Freeze: no interpolation, no cue. Time passing is what ends a rep or a hold.
      if (this.invalidSince === null) this.invalidSince = frame.t;
      const gone = frame.t - this.invalidSince;
      this.validStreak = 0;
      if (gone > this.cfg.lostAfterMs) {
        if (this.framingKey !== 'lost') this.discardInFlight(events);
        this.emitFraming('lost', { k: 'framing', ok: false, hint: 'lost' }, events);
      }
      if (gone > this.cfg.pauseAfterMs) this.paused = true;
      this.lastT = frame.t;
      return events;
    }

    this.invalidSince = null;
    if (this.paused) {
      this.validStreak++;
      this.lastT = frame.t;
      if (this.validStreak < this.cfg.resumeFrames) return events;
      this.paused = false;
      this.framingKey = null;
    } else if (this.framingKey === 'lost') {
      this.framingKey = null;
    }

    const p = (i: number): Pt => this.pts[i]!;
    const hip = p(at(LM.HIP, this.side));
    const nose = this.rawVis[LM.NOSE]! >= this.cfg.feetVisibility ? this.pts[LM.NOSE] : undefined;
    if (nose && Math.abs(nose.x - hip.x) > 0.02) this.facing = nose.x > hip.x ? 1 : -1;
    const torso = dist(p(at(LM.SHOULDER, this.side)), hip);

    const f = framingOf(this.raw!, ids, this.side, 1);
    if (f.ok) this.emitFraming('ok', { k: 'framing', ok: true }, events);
    else this.emitFraming(f.hint!, { k: 'framing', ok: false, hint: f.hint }, events);

    this.step({ p, vis: (i) => this.rawVis[i]!, side: this.side, t: frame.t, facing: this.facing, torso }, events);
    this.lastT = frame.t;
    return events;
  }

  /** For steps: the body is not in the starting position (not a lost frame). */
  protected positionHint(events: EngineEvent[], inPosition: boolean): void {
    if (inPosition) {
      if (this.framingKey === 'position') this.framingKey = null;
      return;
    }
    this.emitFraming('position', { k: 'framing', ok: false, hint: 'position' }, events);
  }

  reset(): void {
    this.filters = [];
    this.pts = [];
    this.rawVis = new Array(33).fill(0);
    this.raw = null;
    this.side = 0;
    this.sideT = null;
    this.facing = 1;
    this.invalidSince = null;
    this.paused = false;
    this.validStreak = 0;
    this.framingKey = null;
    this.lastT = null;
    this.clear();
  }

  /** For tests: whether any frame-derived array is still held. */
  holdsFrameData(): boolean {
    return this.raw !== null || this.pts.length > 0 || this.filters.length > 0;
  }
}

// --- Rep exercises (squat, push-up, lunge) -------------------------------------------------

interface Sample {
  angle: number;
  vals: Record<string, number>;
}
interface RepAgg {
  minAngle: number;
  atMin: Record<string, number>;
  max: Record<string, number>;
  min: Record<string, number>;
}
interface RepSpec {
  exercise: Exclude<FormExercise, 'plank'>;
  downEnter: number;
  upExit: number;
  minMs: number;
  maxMs: number;
  areas: Issue[];
  /** Null when the body is not in position (push-up posture gate). */
  measure(c: Ctx, mem: Record<string, number>, phase: 'arming' | 'up' | 'down', cfg: EngineConfig): Sample | null;
  judge(r: RepAgg): Issue[];
}

const squatSpec: RepSpec = {
  exercise: 'squat',
  // A rep counts once the knee passes 115 degrees; depth is judged separately at 100, so a shallow
  // squat is counted and flagged instead of ignored (the spike text is ambiguous here).
  downEnter: 115,
  upExit: 158,
  minMs: 800,
  maxMs: 8000,
  areas: ['depth', 'knees', 'back'],
  measure(c, mem, phase, cfg) {
    const s = c.side;
    const hip = c.p(at(LM.HIP, s));
    const knee = c.p(at(LM.KNEE, s));
    const ankle = c.p(at(LM.ANKLE, s));
    const vals: Record<string, number> = {
      lean: fromVertical(hip, c.p(at(LM.SHOULDER, s))),
      ahead: -9,
      heelRise: 0,
    };
    const shin = dist(knee, ankle);
    if (c.vis(at(LM.FOOT, s)) >= cfg.feetVisibility && shin > 1e-6) {
      vals.ahead = ((knee.x - c.p(at(LM.FOOT, s)).x) * c.facing) / shin;
    }
    if (c.vis(at(LM.HEEL, s)) >= cfg.feetVisibility) {
      const hy = c.p(at(LM.HEEL, s)).y;
      if (phase !== 'down') mem.heelY = mem.heelY === undefined ? hy : mem.heelY * 0.9 + hy * 0.1;
      else if (mem.heelY !== undefined && c.torso > 1e-6) vals.heelRise = (mem.heelY - hy) / c.torso;
    }
    return { angle: angleAt(hip, knee, ankle), vals };
  },
  judge(r) {
    const out: Issue[] = [];
    if (r.minAngle > 100) out.push('depth');
    if (r.atMin.lean! > 60) out.push('back');
    if (r.atMin.ahead! > 0.35 && r.max.heelRise! > 0.04) out.push('knees');
    return out;
  },
};

const pushUpSpec: RepSpec = {
  exercise: 'push_up',
  downEnter: 115,
  upExit: 155,
  minMs: 600,
  maxMs: 8000,
  areas: ['elbows', 'hips'],
  measure(c) {
    const s = c.side;
    const sh = c.p(at(LM.SHOULDER, s));
    const hip = c.p(at(LM.HIP, s));
    const ankle = c.p(at(LM.ANKLE, s));
    if (fromHorizontal(sh, ankle) > 30) return null;
    return {
      angle: angleAt(sh, c.p(at(LM.ELBOW, s)), c.p(at(LM.WRIST, s))),
      vals: { body: angleAt(sh, hip, ankle) },
    };
  },
  judge(r) {
    const out: Issue[] = [];
    if (r.minAngle > 95) out.push('elbows');
    if (r.min.body! < 150) out.push('hips');
    return out;
  },
};

const lungeSpec: RepSpec = {
  exercise: 'lunge',
  downEnter: 115,
  upExit: 158,
  minMs: 800,
  maxMs: 8000,
  areas: ['depth', 'knees', 'back', 'hips'],
  measure(c, _mem, _phase, cfg) {
    const legs = ([0, 1] as const).map((s) => ({
      hip: c.p(at(LM.HIP, s)),
      knee: c.p(at(LM.KNEE, s)),
      ankle: c.p(at(LM.ANKLE, s)),
      foot: c.p(at(LM.FOOT, s)),
      footVis: c.vis(at(LM.FOOT, s)),
    }));
    // The front leg is the one whose ankle is further in the facing direction.
    const front = legs[0]!.ankle.x * c.facing >= legs[1]!.ankle.x * c.facing ? legs[0]! : legs[1]!;
    const rear = front === legs[0] ? legs[1]! : legs[0]!;
    const shin = dist(front.knee, front.ankle);
    return {
      angle: angleAt(front.hip, front.knee, front.ankle),
      vals: {
        rear: angleAt(rear.hip, rear.knee, rear.ankle),
        ahead: front.footVis >= cfg.feetVisibility && shin > 1e-6 ? ((front.knee.x - front.foot.x) * c.facing) / shin : -9,
        shin: fromVertical(front.ankle, front.knee),
        trunk: fromVertical(front.hip, c.p(at(LM.SHOULDER, c.side))),
        hipRise: c.torso > 1e-6 ? (front.hip.y - rear.hip.y) / c.torso : 0,
      },
    };
  },
  judge(r) {
    const out: Issue[] = [];
    if (r.minAngle > 100 || r.atMin.rear! > 115) out.push('depth');
    if (r.atMin.ahead! > 0.3 || r.atMin.shin! > 25) out.push('knees');
    if (r.atMin.trunk! > 25) out.push('back');
    if (r.atMin.hipRise! > 0.1) out.push('hips');
    return out;
  },
};

const SPECS: Record<Exclude<FormExercise, 'plank'>, RepSpec> = { squat: squatSpec, push_up: pushUpSpec, lunge: lungeSpec };

class RepEngine extends BaseEngine {
  private phase: 'arming' | 'up' | 'down' = 'arming';
  private armSince: number | null = null;
  private downSince = 0;
  private hist: number[] = [];
  private agg: RepAgg | null = null;
  private mem: Record<string, number> = {};
  private reps: { ok: boolean; issues: Issue[] }[] = [];

  constructor(
    private readonly spec: RepSpec,
    cfg?: Partial<EngineConfig>,
  ) {
    super(spec.exercise, cfg);
  }

  protected discardInFlight(events: EngineEvent[]): void {
    if (this.phase === 'down') events.push({ k: 'unscored' });
    this.phase = 'arming';
    this.armSince = null;
    this.agg = null;
    this.hist = [];
  }

  protected step(c: Ctx, events: EngineEvent[]): void {
    const s = this.spec.measure(c, this.mem, this.phase, this.cfg);
    this.positionHint(events, s !== null);
    if (!s) {
      this.discardInFlight(events);
      return;
    }
    this.hist.push(s.angle);
    if (this.hist.length > 3) this.hist.shift();
    const h = this.hist;
    const a = h.length === 3 ? median3(h[0]!, h[1]!, h[2]!) : s.angle;

    if (this.phase === 'arming') {
      if (a > this.spec.upExit) {
        this.armSince ??= c.t;
        if (c.t - this.armSince >= 300) this.phase = 'up';
      } else this.armSince = null;
      return;
    }
    if (this.phase === 'up') {
      if (a < this.spec.downEnter) {
        this.phase = 'down';
        this.downSince = c.t;
        this.agg = { minAngle: a, atMin: { ...s.vals }, max: { ...s.vals }, min: { ...s.vals } };
      }
      return;
    }
    const g = this.agg!;
    if (a < g.minAngle) {
      g.minAngle = a;
      g.atMin = { ...s.vals };
    }
    for (const k of Object.keys(s.vals)) {
      g.max[k] = Math.max(g.max[k] ?? -Infinity, s.vals[k]!);
      g.min[k] = Math.min(g.min[k] ?? Infinity, s.vals[k]!);
    }
    if (a > this.spec.upExit) {
      const dur = c.t - this.downSince;
      this.phase = 'up';
      this.agg = null;
      if (dur >= this.spec.minMs && dur <= this.spec.maxMs) {
        const issues = this.spec.judge(g);
        this.reps.push({ ok: issues.length === 0, issues });
        events.push({ k: 'rep', index: this.reps.length, ok: issues.length === 0, issues });
        if (this.reps.length === COUNT_REPS) events.push({ k: 'counted' });
      }
    } else if (c.t - this.downSince > this.spec.maxMs) {
      this.phase = 'arming';
      this.armSince = null;
      this.agg = null;
    }
  }

  summary(): EngineSummary {
    const n = this.reps.length;
    const clean = this.reps.filter((r) => r.ok).length;
    const findings: EngineFinding[] = n
      ? this.spec.areas.map((area) => ({
          area,
          status: this.reps.filter((r) => r.issues.includes(area)).length / n >= 0.3 ? 'warn' : 'ok',
        }))
      : [];
    return {
      exercise: this.exercise,
      repsAnalysed: n,
      repsClean: clean,
      perRep: this.reps.map((r, i) => ({ index: i + 1, ok: r.ok, ...(r.issues[0] ? { issue: r.issues[0] } : {}) })),
      findings,
      rating: n ? ratingOf(clean / n, 0.8, 0.5) : null,
    };
  }

  protected clear(): void {
    this.phase = 'arming';
    this.armSince = null;
    this.hist = [];
    this.agg = null;
    this.mem = {};
    this.reps = [];
  }
}

// --- Plank (hold) ---------------------------------------------------------------------------

const BRIDGE_MS = 700;
const BLOCK_MS = 5000;

class HoldEngine extends BaseEngine {
  private held = 0;
  private best = 0;
  private lastInPlank: number | null = null;
  private lastTick = -1;
  private counted = false;
  private start: number | null = null;
  private totalMs = 0;
  private inMs = 0;
  private hipsMs = 0;
  private elbowsMs = 0;
  private blocks: { inMs: number; totMs: number }[] = [];

  constructor(cfg?: Partial<EngineConfig>) {
    super('plank', cfg);
  }

  protected discardInFlight(): void {
    // The hold is judged by elapsed time (the bridge rule), so a dropout needs no special handling.
  }

  protected step(c: Ctx, events: EngineEvent[]): void {
    const s = c.side;
    const sh = c.p(at(LM.SHOULDER, s));
    const body = angleAt(sh, c.p(at(LM.HIP, s)), c.p(at(LM.ANKLE, s)));
    const inPlank = 180 - body <= 20 && fromHorizontal(sh, c.p(at(LM.ANKLE, s))) <= 25;
    const elbowOver = c.torso > 1e-6 ? Math.abs(sh.x - c.p(at(LM.ELBOW, s)).x) / c.torso <= 0.15 : true;

    this.start ??= c.t;
    const dt = this.lastT === null ? 0 : Math.min(500, Math.max(0, c.t - this.lastT));
    this.totalMs += dt;
    const b = Math.floor((c.t - this.start) / BLOCK_MS);
    while (this.blocks.length <= b) this.blocks.push({ inMs: 0, totMs: 0 });
    this.blocks[b]!.totMs += dt;
    if (inPlank) {
      this.inMs += dt;
      this.blocks[b]!.inMs += dt;
      if (!elbowOver) this.elbowsMs += dt;
    } else this.hipsMs += dt;

    if (inPlank) {
      if (this.lastInPlank !== null && c.t - this.lastInPlank <= BRIDGE_MS) this.held += c.t - this.lastInPlank;
      else {
        this.held = 0;
        this.lastTick = -1;
      }
      this.lastInPlank = c.t;
      this.best = Math.max(this.best, this.held);
      const tick = Math.floor(this.held / 250);
      if (tick > this.lastTick) {
        this.lastTick = tick;
        events.push({ k: 'hold', ms: this.held });
      }
      if (!this.counted && this.held >= COUNT_HOLD_MS) {
        this.counted = true;
        events.push({ k: 'counted' });
      }
    } else if (this.lastInPlank !== null && c.t - this.lastInPlank > BRIDGE_MS && this.held > 0) {
      this.held = 0;
      this.lastTick = -1;
      events.push({ k: 'hold', ms: 0 });
    }
  }

  summary(): EngineSummary {
    const blocks = this.blocks.filter((x) => x.totMs >= 2500);
    const perRep = blocks.map((x, i) => {
      const ok = x.inMs / x.totMs >= 0.8;
      return { index: i + 1, ok, ...(ok ? {} : { issue: 'hips' as Issue }) };
    });
    const share = this.totalMs > 0 ? this.inMs / this.totalMs : 0;
    const findings: EngineFinding[] = perRep.length
      ? [
          { area: 'hips', status: this.hipsMs >= 1000 ? 'warn' : 'ok' },
          { area: 'elbows', status: this.elbowsMs >= 1000 ? 'warn' : 'ok' },
        ]
      : [];
    return {
      exercise: 'plank',
      repsAnalysed: perRep.length,
      repsClean: perRep.filter((r) => r.ok).length,
      perRep,
      findings,
      rating: perRep.length ? ratingOf(share, 0.85, 0.6) : null,
      holdSeconds: Math.round(this.best / 100) / 10,
    };
  }

  protected clear(): void {
    this.held = 0;
    this.best = 0;
    this.lastInPlank = null;
    this.lastTick = -1;
    this.counted = false;
    this.start = null;
    this.totalMs = 0;
    this.inMs = 0;
    this.hipsMs = 0;
    this.elbowsMs = 0;
    this.blocks = [];
  }
}

export type PoseEngine = Engine & { holdsFrameData(): boolean };

export function createEngine(exercise: FormExercise, cfg?: Partial<EngineConfig>): PoseEngine {
  if (exercise === 'plank') return new HoldEngine(cfg);
  return new RepEngine(SPECS[exercise], cfg);
}
