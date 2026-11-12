// One store drives every screen in the Player family. Time comes from a monotonic clock:
// the store keeps `positionMs` at an anchor and derives "now" as anchor + (clock - anchorMono).
// Ticks only trigger side effects (cues, completion, snapshots); they never count time.

import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { getSessionDeps } from './deps';
import {
  lastRestOfStep,
  locate,
  nextRestFrom,
  stepRange,
  totalMs,
} from './locate';
import { effOf, positionAt } from './view';
import {
  DEFAULT_PREFS,
  setKey,
  type Cue,
  type FeelValue,
  type Felt,
  type PauseReason,
  type Rung,
  type SessionLogRow,
  type SessionPlan,
  type SessionPrefs,
  type Timeline,
} from './types';

export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SNAPSHOT_EVERY_MS = 5000;
/**
 * A longer silence than this between two ticks means the app was not running (process frozen,
 * emulator restored, device asleep). That time is not exercise: pause and credit none of it.
 */
export const MAX_TICK_GAP_MS = 10_000;
export const MAX_EXTRA_REST_MS = 90_000;
/** Sessions under this length skip the Feel prompt (PRD). */
export const FEEL_MIN_SESSION_S = 8 * 60;
/** Unfinished sessions shorter than this are not logged (server clamps duration_s to 60..3600). */
export const MIN_LOGGED_S = 60;

/** The rest a +15s / +30s press would change: the one running now, or the next one. */
export interface RestTarget {
  index: number;
  where: 'current' | 'next';
  /** Extra ms already added to this rest. */
  extraMs: number;
  /** Whole length of this rest now, in ms. */
  restMs: number;
  /** The move this rest follows. */
  after: string;
  atMax: boolean;
}

export type AddRestResult =
  | { ok: true; where: 'current' | 'next'; addedMs: number; extraMs: number; restMs: number; after: string; capped: boolean }
  | { ok: false; reason: 'none' | 'max' | 'inactive' };

/** Rests change to the 'Rest between sets' setting from this segment on. */
export interface RestPref {
  restS: number;
  /** Segments with an index above this one change. */
  after: number;
}

export type SessionStatus = 'idle' | 'active' | 'paused' | 'confirm_end' | 'ended' | 'complete';

export interface SessionState {
  status: SessionStatus;
  plan: SessionPlan | null;
  timeline: Timeline | null;
  rungBySet: Record<string, Rung>;
  /** Extra rest in ms, per timeline segment index. */
  extras: Record<number, number>;
  /** Session position at the anchor. */
  positionMs: number;
  /** Monotonic clock reading when positionMs was true (active only). */
  anchorMono: number;
  /** Playing time before the anchor. */
  activeMs: number;
  pausedReason: PauseReason | null;
  resumeBy: number;
  /** What to go back to when "Keep going" is pressed. */
  resumeTo: 'active' | 'paused' | null;
  outcome: 'saved_for_later' | 'discarded' | null;
  startedAt: number;
  planWeek: number;
  planDay: number;
  prefs: SessionPrefs;
  rung: Rung;
  feelPending: boolean;
  feelShown: boolean;
  feelSignals: { stepIdx: number; value: FeelValue }[];
  rungChanges: { stepIdx: number; rung: Rung }[];
  skipped: string[];
  formChecks: number;
  firedCues: Record<string, true>;
  lastSnapshotMono: number;
  /** Clock reading at the last tick or (re)start while active; 0 when unset. */
  lastTickMono: number;
  logged: boolean;
  /** When a finished session was restored from a snapshot: the time it was last saved, so the log keeps its own day. 0 otherwise. */
  restoredAt: number;
  /** Single-move mode ("Try 30 seconds"): one move, never logged, never snapshotted. */
  trial: boolean;
  /** Set when the user picks a rest length in Sound and voice. Null = rests as planned. */
  restPref: RestPref | null;
}

/** True when the session is open on the Ready screen: first move shown, clock not running. */
export function isReady(s: Pick<SessionState, 'status' | 'pausedReason'>): boolean {
  return s.status === 'paused' && s.pausedReason === 'ready';
}

/** Applies the rest setting to the rests that come after segment `after`. Pure. */
export function applyRestPref(timeline: Timeline, pref: RestPref | null): Timeline {
  if (!pref) return timeline;
  let t = 0;
  let warmupS = 0;
  let workS = 0;
  let cooldownS = 0;
  const segments = timeline.segments.map((seg) => {
    const durationS = seg.kind === 'rest' && seg.phase === 'work' && seg.index > pref.after ? pref.restS : seg.durationS;
    const next = { ...seg, startS: t, durationS, endS: t + durationS };
    t += durationS;
    if (seg.phase === 'warmup') warmupS += durationS;
    else if (seg.phase === 'work') workS += durationS;
    else cooldownS += durationS;
    return next;
  });
  return { segments, totalS: t, warmupS, workS, cooldownS };
}

/** Which rest would +15s / +30s change right now? Null when no rest is left. */
export function restTarget(s: SessionState, now: number): RestTarget | null {
  if (!s.plan || !s.timeline) return null;
  const eff = effOf(s);
  const pos = positionAt(s, now);
  const loc = locate(eff, pos);
  if (!loc) return null;
  const target = loc.seg.kind === 'rest' ? loc : nextRestFrom(eff, pos);
  if (!target) return null;
  const extraMs = s.extras[target.seg.index] ?? 0;
  return {
    index: target.seg.index,
    where: loc.seg.kind === 'rest' ? 'current' : 'next',
    extraMs,
    restMs: target.endMs - target.startMs,
    after: s.plan.steps[target.seg.stepIndex]?.name ?? '',
    atMax: extraMs >= MAX_EXTRA_REST_MS,
  };
}

/** True when nothing is left to play: the session is complete, or the position is at the end. */
export function isFinished(s: Pick<SessionState, 'status' | 'plan' | 'timeline' | 'positionMs' | 'extras' | 'rungBySet'>): boolean {
  if (!s.plan) return false;
  if (s.status === 'complete') return true;
  if (!s.timeline || (s.status !== 'paused' && s.status !== 'confirm_end')) return false;
  return s.positionMs >= totalMs(effOf(s as SessionState));
}

export interface StartOptions {
  planWeek?: number;
  planDay?: number;
  prefs?: Partial<SessionPrefs>;
  /** Run as a single-move trial (see `startTrial`). */
  trial?: boolean;
}

export interface SessionActions {
  start(plan: SessionPlan, opts?: StartOptions): void;
  tick(): void;
  pause(reason?: PauseReason): void;
  resume(): void;
  skipMove(): void;
  skipRest(): void;
  previous(): void;
  addRest(seconds: 15 | 30): AddRestResult;
  setRung(rung: Rung): void;
  requestEnd(): void;
  keepGoing(): void;
  saveForLater(): Promise<void>;
  endWithoutSaving(): Promise<void>;
  openFeel(): void;
  answerFeel(value: FeelValue | null): void;
  noteFormCheck(): void;
  setPrefs(patch: Partial<SessionPrefs>): void;
  /** Writes the complete log once, clears the snapshot. */
  finalizeComplete(felt: Felt | null): Promise<void>;
  /** Logs a restored session that had already finished but was never saved, then clears the snapshot. */
  saveFinished(): Promise<void>;
  /** Drops a restored finished session without logging it. */
  discardFinished(): Promise<void>;
  restoreFromSnapshot(): Promise<boolean>;
  expireStale(): Promise<void>;
  reset(): void;
}

export type SessionStore = SessionState & SessionActions;

const initial = (): SessionState => ({
  status: 'idle',
  plan: null,
  timeline: null,
  rungBySet: {},
  extras: {},
  positionMs: 0,
  anchorMono: 0,
  activeMs: 0,
  pausedReason: null,
  resumeBy: 0,
  resumeTo: null,
  outcome: null,
  startedAt: 0,
  planWeek: 1,
  planDay: 0,
  prefs: DEFAULT_PREFS,
  rung: 0,
  feelPending: false,
  feelShown: false,
  feelSignals: [],
  rungChanges: [],
  skipped: [],
  formChecks: 0,
  firedCues: {},
  lastSnapshotMono: 0,
  lastTickMono: 0,
  logged: false,
  restoredAt: 0,
  trial: false,
  restPref: null,
});

// ---- Snapshot (de)serialisation ----

interface SnapshotBody {
  v: 1;
  plan: SessionPlan;
  rungBySet: Record<string, Rung>;
  extras: Record<number, number>;
  positionMs: number;
  activeMs: number;
  rung: Rung;
  feelShown: boolean;
  feelSignals: SessionState['feelSignals'];
  rungChanges: SessionState['rungChanges'];
  skipped: string[];
  formChecks: number;
  prefs: SessionPrefs;
  complete: boolean;
  restPref?: RestPref | null;
}

export function serialiseState(s: SessionState, now: number): string {
  const body: SnapshotBody = {
    v: 1,
    plan: s.plan!,
    rungBySet: s.rungBySet,
    extras: s.extras,
    positionMs: positionAt(s, now),
    activeMs: s.activeMs + (s.status === 'active' ? now - s.anchorMono : 0),
    rung: s.rung,
    feelShown: s.feelShown,
    feelSignals: s.feelSignals,
    rungChanges: s.rungChanges,
    skipped: s.skipped,
    formChecks: s.formChecks,
    prefs: s.prefs,
    complete: s.status === 'complete',
    restPref: s.restPref,
  };
  return JSON.stringify(body);
}

// ---- Log helpers ----

export function movesDone(s: SessionState, pos: number): number {
  if (!s.plan) return 0;
  const eff = effOf(s);
  let n = 0;
  s.plan.steps.forEach((st, i) => {
    if (st.phase !== 'work' || s.skipped.includes(st.id)) return;
    const r = stepRange(eff, i);
    if (r && pos >= r.endMs) n += 1;
  });
  return n;
}

function buildLog(s: SessionState, now: number, status: 'complete' | 'unfinished', felt: Felt | null): SessionLogRow {
  const deps = getSessionDeps();
  const pos = positionAt(s, now);
  const active = s.activeMs + (s.status === 'active' ? now - s.anchorMono : 0);
  return {
    id: deps.newId(),
    planWeek: s.planWeek,
    planDay: s.planDay,
    style: s.plan!.style,
    status,
    durationS: Math.round(active / 1000),
    movesDone: movesDone(s, pos),
    movesPlanned: s.plan!.steps.filter((x) => x.phase === 'work').length,
    felt,
    rungChanges: s.rungChanges,
    feelSignals: s.feelSignals,
    warmupSkipped: s.plan!.steps.some((x) => x.phase === 'warmup' && s.skipped.includes(x.id)),
    formChecks: s.formChecks,
    quiet: s.prefs.quiet,
    completedAt: status === 'complete' && s.restoredAt > 0 ? s.restoredAt : deps.clock.wall(),
  };
}

// ---- Cues ----

function cueForSegmentStart(s: SessionState, segIndex: number): Cue | null {
  const plan = s.plan!;
  const seg = s.timeline!.segments[segIndex]!;
  const step = plan.steps[seg.stepIndex]!;
  const next = plan.steps[seg.stepIndex + 1];
  if (seg.kind === 'transition') return { kind: 'get_ready', name: step.name, exerciseId: step.exerciseId };
  if (seg.kind === 'work') {
    if (seg.side === 'L' && step.sides === 'each') return { kind: 'switch_sides', name: step.name };
    if (seg.set === 1) {
      const prev = plan.steps[seg.stepIndex - 1];
      if (step.phase === 'cooldown' && prev && prev.phase !== 'cooldown') {
        return { kind: 'cooldown', name: step.name, exerciseId: step.exerciseId };
      }
      return { kind: 'step_start', name: step.name, exerciseId: step.exerciseId };
    }
    return null;
  }
  // rest
  if (seg.set === step.sets && next) return { kind: 'up_next', name: next.name, exerciseId: next.exerciseId };
  return { kind: 'rest', name: step.name };
}

// ---- Store ----

export function createSessionStore(): UseBoundStore<StoreApi<SessionStore>> {
  return create<SessionStore>()((set, get) => {
    const deps = () => getSessionDeps();

    const persist = (force = false): Promise<void> => {
      const s = get();
      // A 30-second trial never leaves a snapshot behind, so Home never offers to resume it.
      if (!s.plan || s.trial || s.status === 'idle' || s.status === 'ended') return Promise.resolve();
      // Never saved while it is still on the Ready screen: nothing has been done yet.
      if (isReady(s)) return Promise.resolve();
      const d = deps();
      const mono = d.clock.now();
      if (!force && mono - s.lastSnapshotMono < SNAPSHOT_EVERY_MS) return Promise.resolve();
      const wall = d.clock.wall();
      set({ lastSnapshotMono: mono });
      return d.snapshot.save({
        planDayWeek: s.planWeek,
        planDayIndex: s.planDay,
        startedAt: s.startedAt,
        stateJson: serialiseState(s, mono),
        snapshotAt: wall,
        expiresAt: s.status === 'active' || s.status === 'confirm_end' ? wall + RESUME_WINDOW_MS : s.resumeBy || wall + RESUME_WINDOW_MS,
      });
    };

    /** Freeze playing time into positionMs / activeMs. */
    const freeze = (now: number): Partial<SessionState> => {
      const s = get();
      if (s.status !== 'active') return {};
      return { positionMs: positionAt(s, now), activeMs: s.activeMs + (now - s.anchorMono) };
    };

    const rebuild = (plan: SessionPlan, rungBySet: Record<string, Rung>, restPref: RestPref | null = get().restPref): Timeline =>
      applyRestPref(deps().buildTimeline(plan, { rungBySet }), restPref);

    const jumpTo = (ms: number) => {
      const d = deps();
      const s = get();
      set({ positionMs: ms, anchorMono: d.clock.now(), activeMs: s.activeMs + (s.status === 'active' ? d.clock.now() - s.anchorMono : 0) });
    };

    const complete = () => {
      const d = deps();
      const s = get();
      const now = d.clock.now();
      const total = totalMs(effOf(s));
      set({ ...freeze(now), positionMs: total, status: 'complete' });
      d.keepAwake.deactivate();
      d.cues.play({ kind: 'done' }, s.prefs);
      void persist(true);
    };

    return {
      ...initial(),

      start(plan, opts = {}) {
        const d = deps();
        const now = d.clock.now();
        const timeline = rebuild(plan, {}, null);
        // The screen stays on while the user gets in position, but the clock does not run.
        d.keepAwake.activate();
        set({
          ...initial(),
          status: 'paused',
          pausedReason: 'ready',
          plan,
          timeline,
          anchorMono: now,
          lastTickMono: 0,
          startedAt: d.clock.wall(),
          planWeek: opts.planWeek ?? 1,
          planDay: opts.planDay ?? 0,
          prefs: { ...DEFAULT_PREFS, ...opts.prefs },
          resumeBy: d.clock.wall() + RESUME_WINDOW_MS,
          trial: !!opts.trial,
        });
      },

      tick() {
        const s = get();
        if (s.status !== 'active' || !s.timeline || !s.plan) return;
        const d = deps();
        const now = d.clock.now();
        if (s.lastTickMono > 0 && now - s.lastTickMono > MAX_TICK_GAP_MS) {
          // The app was not running. Count active time only up to the last tick we saw.
          d.cues.stop();
          d.keepAwake.deactivate();
          set({
            ...freeze(s.lastTickMono),
            status: 'paused',
            pausedReason: 'background',
            resumeBy: d.clock.wall() + RESUME_WINDOW_MS,
            lastTickMono: 0,
          });
          void persist(true);
          return;
        }
        set({ lastTickMono: now });
        const eff = effOf(s);
        const total = totalMs(eff);
        const pos = positionAt(s, now);
        if (pos >= total) {
          complete();
          return;
        }
        const loc = locate(eff, pos);
        if (!loc) return;
        const seg = loc.seg;
        const step = s.plan.steps[seg.stepIndex]!;
        const fired = { ...s.firedCues };
        let cue: Cue | null = null;

        const startKey = `s${seg.index}`;
        if (!fired[startKey]) {
          fired[startKey] = true;
          cue = cueForSegmentStart(s, seg.index);
        }
        const remaining = loc.endMs - pos;
        const segMs = loc.endMs - loc.startMs;
        if (!cue && segMs >= 5000 && remaining <= 3000) {
          const n = remaining > 2000 ? 3 : remaining > 1000 ? 2 : 1;
          const key = `c${seg.index}:${n}`;
          if (!fired[key]) {
            for (let k = 3; k >= n; k -= 1) fired[`c${seg.index}:${k}`] = true;
            fired[`t${seg.index}`] = true;
            cue = { kind: 'count', count: n };
          }
        } else if (!cue && seg.kind === 'work' && segMs >= 15000 && remaining <= 10000 && remaining > 3000) {
          const key = `t${seg.index}`;
          if (!fired[key]) {
            fired[key] = true;
            cue = { kind: 'ten_seconds' };
          }
        }

        // Feel prompt: once, in the rest after the middle move, never over a timed interval.
        let feelPending = s.feelPending;
        if (!s.feelShown && !feelPending && seg.kind === 'rest' && step.phase === 'work' && seg.set === step.sets) {
          const work = s.plan.steps.filter((x) => x.phase === 'work');
          const mid = work[Math.floor((work.length - 1) / 2)];
          if (mid && mid.id === step.id && total / 1000 >= FEEL_MIN_SESSION_S) feelPending = true;
        }

        set({ firedCues: fired, feelPending });
        if (cue) d.cues.play(cue, s.prefs);
        void persist(!s.firedCues[startKey]);
      },

      pause(reason = 'user') {
        const s = get();
        if (s.status !== 'active') return;
        const d = deps();
        d.cues.stop();
        d.keepAwake.deactivate();
        set({
          ...freeze(d.clock.now()),
          status: 'paused',
          pausedReason: reason,
          resumeBy: d.clock.wall() + RESUME_WINDOW_MS,
        });
        void persist(true);
      },

      resume() {
        const s = get();
        if (s.status !== 'paused') return;
        const d = deps();
        if (d.clock.wall() > s.resumeBy) {
          void get().endWithoutSaving();
          return;
        }
        const wasReady = s.pausedReason === 'ready';
        d.keepAwake.activate();
        set({
          status: 'active',
          anchorMono: d.clock.now(),
          lastTickMono: d.clock.now(),
          pausedReason: null,
          // The clock starts here: the session's start time is the tap on Start.
          ...(wasReady ? { startedAt: d.clock.wall(), resumeBy: d.clock.wall() + RESUME_WINDOW_MS } : {}),
        });
        // First tap on Start: play the first cue now, as the old immediate start did.
        if (wasReady) get().tick();
        void persist(true);
      },

      skipMove() {
        const s = get();
        if (!s.plan || (s.status !== 'active' && s.status !== 'paused')) return;
        const d = deps();
        const eff = effOf(s);
        const loc = locate(eff, positionAt(s, d.clock.now()));
        if (!loc) return;
        const idx = loc.seg.stepIndex;
        const step = s.plan.steps[idx]!;
        const skipped = s.skipped.includes(step.id) ? s.skipped : [...s.skipped, step.id];
        const lastRest = lastRestOfStep(eff, idx);
        const range = stepRange(eff, idx);
        // Go to the rest that closes the move. If already there, go to the next move.
        const target = lastRest && loc.startMs < lastRest.startMs ? lastRest.startMs : (range?.endMs ?? loc.endMs);
        set({ skipped });
        jumpTo(target);
        get().tick();
        void persist(true);
      },

      skipRest() {
        const s = get();
        if (!s.plan || (s.status !== 'active' && s.status !== 'paused')) return;
        const d = deps();
        const eff = effOf(s);
        const loc = locate(eff, positionAt(s, d.clock.now()));
        if (!loc || loc.seg.kind === 'work') return;
        jumpTo(loc.endMs);
        get().tick();
        void persist(true);
      },

      previous() {
        const s = get();
        if (!s.plan || (s.status !== 'active' && s.status !== 'paused')) return;
        const d = deps();
        const eff = effOf(s);
        const pos = positionAt(s, d.clock.now());
        const loc = locate(eff, pos);
        if (!loc) return;
        const cur = stepRange(eff, loc.seg.stepIndex)!;
        // More than 3 s into a move: restart it. Otherwise go to the one before.
        const idx = pos - cur.startMs > 3000 || loc.seg.stepIndex === 0 ? loc.seg.stepIndex : loc.seg.stepIndex - 1;
        const target = stepRange(eff, idx)!.startMs;
        // Re-arm cues from the target onward.
        const fired: Record<string, true> = {};
        for (const k of Object.keys(s.firedCues)) {
          const m = /^[sct](\d+)/.exec(k);
          const seg = m ? eff[Number(m[1])] : undefined;
          if (seg && seg.startMs < target) fired[k] = true;
        }
        set({ firedCues: fired });
        jumpTo(target);
        get().tick();
        void persist(true);
      },

      addRest(seconds) {
        const s = get();
        if (!s.plan || (s.status !== 'active' && s.status !== 'paused')) return { ok: false, reason: 'inactive' };
        const d = deps();
        // Current rest if resting, else the next rest (A6).
        const t = restTarget(s, d.clock.now());
        if (!t) return { ok: false, reason: 'none' };
        const cur = s.extras[t.index] ?? 0;
        const next = Math.min(MAX_EXTRA_REST_MS, cur + seconds * 1000);
        if (next === cur) return { ok: false, reason: 'max' };
        // Keep the running position: re-anchor before the segment table changes.
        const frozen = freeze(d.clock.now());
        set({ ...frozen, anchorMono: d.clock.now(), extras: { ...s.extras, [t.index]: next } });
        void persist(true);
        const added = next - cur;
        return {
          ok: true,
          where: t.where,
          addedMs: added,
          extraMs: next,
          restMs: t.restMs + added,
          after: t.after,
          capped: next >= MAX_EXTRA_REST_MS && added < seconds * 1000,
        };
      },

      setRung(rung) {
        const s = get();
        if (!s.plan || !s.timeline || (s.status !== 'active' && s.status !== 'paused')) return;
        const d = deps();
        const eff = effOf(s);
        const pos = positionAt(s, d.clock.now());
        const loc = locate(eff, pos);
        if (!loc) return;
        const cutStep = loc.seg.stepIndex;
        const cutSet = loc.seg.set;
        const rungBySet = { ...s.rungBySet };
        s.plan.steps.forEach((st, i) => {
          if (st.phase !== 'work') return;
          for (let k = 1; k <= st.sets; k += 1) {
            if (i > cutStep || (i === cutStep && k > cutSet)) rungBySet[setKey(st.id, k)] = rung;
          }
        });
        const timeline = rebuild(s.plan, rungBySet);
        const frozen = freeze(d.clock.now());
        set({
          ...frozen,
          anchorMono: d.clock.now(),
          timeline,
          rungBySet,
          rung,
          rungChanges: [...s.rungChanges, { stepIdx: cutStep, rung }],
        });
        void persist(true);
      },

      requestEnd() {
        const s = get();
        if (s.status !== 'active' && s.status !== 'paused') return;
        const d = deps();
        d.keepAwake.deactivate();
        set({ ...freeze(d.clock.now()), status: 'confirm_end', resumeTo: s.status });
      },

      keepGoing() {
        const s = get();
        if (s.status !== 'confirm_end') return;
        const d = deps();
        if (s.resumeTo === 'active') {
          d.keepAwake.activate();
          set({ status: 'active', anchorMono: d.clock.now(), resumeTo: null });
        } else {
          if (s.pausedReason === 'ready') d.keepAwake.activate();
          set({ status: 'paused', resumeTo: null });
        }
      },

      async saveForLater() {
        const s = get();
        if (!s.plan || s.status !== 'confirm_end') return;
        const d = deps();
        d.cues.stop();
        d.keepAwake.deactivate();
        const wall = d.clock.wall();
        set({ pausedReason: 'user', resumeBy: wall + RESUME_WINDOW_MS });
        await persist(true);
        set({ status: 'ended', outcome: 'saved_for_later', resumeTo: null });
      },

      async endWithoutSaving() {
        const s = get();
        if (!s.plan || (s.status !== 'confirm_end' && s.status !== 'paused' && s.status !== 'active')) return;
        const d = deps();
        d.cues.stop();
        d.keepAwake.deactivate();
        const now = d.clock.now();
        const row = buildLog(s, now, 'unfinished', null);
        set({ status: 'ended', outcome: 'discarded', resumeTo: null });
        if (s.trial) return;
        await d.snapshot.clear();
        if (row.durationS >= MIN_LOGGED_S) await d.sessionLog.insert(row);
      },

      openFeel() {
        set({ feelPending: false, feelShown: true });
      },

      answerFeel(value) {
        const s = get();
        set({ feelPending: false, feelShown: true });
        if (!value) return;
        const stepIdx = s.plan && s.timeline ? (locate(effOf(s), positionAt(s, deps().clock.now()))?.seg.stepIndex ?? 0) : 0;
        set({ feelSignals: [...get().feelSignals, { stepIdx, value }] });
        // One tap changes the next set (D12): easy -> harder, hard -> easier, good -> keep.
        if (value === 'easy') get().setRung(1);
        else if (value === 'hard') get().setRung(-1);
      },

      noteFormCheck() {
        set({ formChecks: get().formChecks + 1 });
      },

      setPrefs(patch) {
        const before = get();
        const prefs = { ...before.prefs, ...patch };
        set({ prefs });
        // A new rest length applies to every rest after the one in progress.
        const live = before.status === 'active' || before.status === 'paused' || before.status === 'confirm_end';
        if (patch.restS !== undefined && patch.restS !== before.prefs.restS && live && before.plan && before.timeline) {
          const loc = locate(effOf(before), positionAt(before, deps().clock.now()));
          const restPref: RestPref = { restS: prefs.restS, after: loc ? loc.seg.index : before.timeline.segments.length };
          set({ restPref, timeline: rebuild(before.plan, before.rungBySet, restPref) });
          void persist(true);
        }
        void deps().prefs.save(prefs);
      },

      async finalizeComplete(felt) {
        const s = get();
        if (!s.plan || s.status !== 'complete' || s.logged || s.trial) return;
        const d = deps();
        set({ logged: true });
        const row = buildLog(s, d.clock.now(), 'complete', felt);
        await d.sessionLog.insert(row);
        await d.snapshot.clear();
      },

      async saveFinished() {
        const s = get();
        if (!s.plan || s.trial || !isFinished(s)) return;
        if (s.status !== 'complete') set({ status: 'complete', positionMs: totalMs(effOf(s)), resumeTo: null });
        // Same path as the Complete screen. No feel answer was given, so none is stored.
        await get().finalizeComplete(null);
      },

      async discardFinished() {
        const s = get();
        if (!s.plan || !isFinished(s)) return;
        await deps().snapshot.clear();
      },

      async restoreFromSnapshot() {
        const d = deps();
        const wall = d.clock.wall();
        const row = await d.snapshot.load(wall);
        if (!row) return false;
        let body: SnapshotBody;
        try {
          body = JSON.parse(row.stateJson) as SnapshotBody;
        } catch {
          await d.snapshot.clear();
          return false;
        }
        if (body.v !== 1 || !body.plan || row.expiresAt <= wall) return false;
        set({
          ...initial(),
          status: body.complete ? 'complete' : 'paused',
          pausedReason: body.complete ? null : 'user',
          plan: body.plan,
          rungBySet: body.rungBySet,
          extras: body.extras,
          restPref: body.restPref ?? null,
          timeline: rebuild(body.plan, body.rungBySet, body.restPref ?? null),
          positionMs: body.positionMs,
          activeMs: body.activeMs,
          rung: body.rung,
          feelShown: body.feelShown,
          feelSignals: body.feelSignals,
          rungChanges: body.rungChanges,
          skipped: body.skipped,
          formChecks: body.formChecks,
          prefs: body.prefs,
          startedAt: row.startedAt,
          planWeek: row.planDayWeek ?? 1,
          planDay: row.planDayIndex ?? 0,
          resumeBy: row.expiresAt,
          // Cues for the segment we land in already played once.
          firedCues: {},
        });
        // Mark the landing segment as already announced.
        const st = get();
        const loc = locate(effOf(st), body.positionMs);
        if (loc) set({ firedCues: { [`s${loc.seg.index}`]: true } });
        // A finished session keeps the day it finished, if it is saved later.
        if (isFinished(get())) set({ restoredAt: row.snapshotAt });
        return true;
      },

      async expireStale() {
        const d = deps();
        // load(0) returns the row whatever its expiry, so an expired one can be logged.
        const row = await d.snapshot.load(0);
        if (!row || row.expiresAt > d.clock.wall()) return;
        try {
          const body = JSON.parse(row.stateJson) as SnapshotBody;
          const stub: SessionState = {
            ...initial(),
            status: 'paused',
            plan: body.plan,
            rungBySet: body.rungBySet,
            extras: body.extras,
            restPref: body.restPref ?? null,
            timeline: applyRestPref(deps().buildTimeline(body.plan, { rungBySet: body.rungBySet }), body.restPref ?? null),
            positionMs: body.positionMs,
            activeMs: body.activeMs,
            skipped: body.skipped,
            rungChanges: body.rungChanges,
            feelSignals: body.feelSignals,
            formChecks: body.formChecks,
            prefs: body.prefs,
            planWeek: row.planDayWeek ?? 1,
            planDay: row.planDayIndex ?? 0,
          };
          if (!body.complete) {
            const log = buildLog(stub, d.clock.now(), 'unfinished', null);
            if (log.durationS >= MIN_LOGGED_S) await d.sessionLog.insert({ ...log, completedAt: row.expiresAt });
          }
        } finally {
          await d.snapshot.clear();
        }
      },

      reset() {
        deps().keepAwake.deactivate();
        set(initial());
      },
    };
  });
}

export const useSessionStore = createSessionStore();
