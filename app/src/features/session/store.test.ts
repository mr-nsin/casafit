import { locate, totalMs } from './locate';
import { MAX_TICK_GAP_MS, movesDone, RESUME_WINDOW_MS } from './store';
import { createHarness, makePlan } from './testkit';
import { deriveView, effOf, formatClock } from './view';
import { getSessionDeps } from './deps';

const plan = () => makePlan();

describe('session timeline', () => {
  it('is exactly 15:00 and the clock drives position', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    const s = h.store.getState();
    expect(s.timeline!.totalS).toBe(900);
    expect(totalMs(effOf(s))).toBe(900_000);
    expect(deriveView(s, h.clock.now()).sessionRemainingMs).toBe(900_000);
    h.advance(30_000);
    const v = deriveView(h.store.getState(), h.clock.now());
    expect(v.phase).toBe('warmup');
    expect(v.stepIndex).toBe(1);
    expect(v.sessionRemainingMs).toBe(870_000);
  });

  it('keeps position when ticks arrive late but within the gap limit', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.clock.advance(MAX_TICK_GAP_MS - 1000);
    h.store.getState().tick();
    expect(h.store.getState().status).toBe('active');
    expect(deriveView(h.store.getState(), h.clock.now()).elapsedMs).toBe(MAX_TICK_GAP_MS - 1000);
  });

  it('walks transition, work, rest through a move', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000);
    let v = deriveView(h.store.getState(), h.clock.now());
    expect(v.kind).toBe('transition');
    h.advance(12_000);
    v = deriveView(h.store.getState(), h.clock.now());
    expect([v.kind, v.set, v.moveNumber, v.moveCount]).toEqual(['work', 1, 1, 5]);
    h.advance(40_000);
    v = deriveView(h.store.getState(), h.clock.now());
    expect(v.kind).toBe('rest');
    expect(v.upNext?.sameStep).toBe(true);
  });

  it('completes at 15:00 and writes nothing until finalised', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(900_000);
    expect(h.store.getState().status).toBe('complete');
    expect(h.keepAwake.active).toBe(false);
    expect(h.cues[h.cues.length - 1]?.kind).toBe('done');
    expect(h.logs).toHaveLength(0);
    await h.store.getState().finalizeComplete('hard');
    await h.store.getState().finalizeComplete('easy'); // second call is ignored
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({ status: 'complete', felt: 'hard', durationS: 900, movesDone: 5, movesPlanned: 5 });
    expect(h.getSnapshot()).toBeNull();
  });
});

describe('pause and resume', () => {
  it('freezes time while paused and restores the same position', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(150_000);
    const before = deriveView(h.store.getState(), h.clock.now());
    h.store.getState().pause('call');
    expect(h.keepAwake.active).toBe(false);
    h.advance(600_000);
    const during = deriveView(h.store.getState(), h.clock.now());
    expect(during.segmentRemainingMs).toBe(before.segmentRemainingMs);
    expect(during.pausedReason).toBe('call');
    h.store.getState().resume();
    h.advance(1000);
    const after = deriveView(h.store.getState(), h.clock.now());
    expect(after.segmentRemainingMs).toBe(before.segmentRemainingMs - 1000);
    expect(h.store.getState().activeMs + 0).toBe(150_000);
  });

  it('ignores wall-clock jumps while running', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.clock.jumpWall(5 * 3600_000);
    h.advance(10_000);
    expect(deriveView(h.store.getState(), h.clock.now()).elapsedMs).toBe(10_000);
  });

  it('saves a snapshot on pause and restores it as paused', async () => {
    const h = createHarness();
    h.store.getState().start(plan(), { planWeek: 2, planDay: 3 });
    h.advance(200_000);
    h.store.getState().pause('user');
    const snap = h.getSnapshot()!;
    expect(snap.planDayWeek).toBe(2);
    expect(snap.expiresAt - snap.snapshotAt).toBe(RESUME_WINDOW_MS);
    h.store.getState().reset();
    expect(h.store.getState().status).toBe('idle');
    expect(await h.store.getState().restoreFromSnapshot()).toBe(true);
    const s = h.store.getState();
    expect(s.status).toBe('paused');
    expect(s.positionMs).toBe(200_000);
    expect(s.planDay).toBe(3);
  });

  it('does not restore after 24 h and logs the session as unfinished', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(300_000);
    h.store.getState().pause('user');
    h.store.getState().reset();
    h.clock.advance(RESUME_WINDOW_MS + 1000);
    await h.store.getState().expireStale();
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({ status: 'unfinished', durationS: 300 });
    expect(h.getSnapshot()).toBeNull();
    expect(await h.store.getState().restoreFromSnapshot()).toBe(false);
  });
});

describe('early end', () => {
  it('Keep going resumes an active session where it was', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(50_000);
    h.store.getState().requestEnd();
    expect(h.store.getState().status).toBe('confirm_end');
    h.advance(30_000); // dialog open: clock stopped
    h.store.getState().keepGoing();
    expect(h.store.getState().status).toBe('active');
    expect(deriveView(h.store.getState(), h.clock.now()).elapsedMs).toBe(50_000);
  });

  it('Save and finish later keeps a snapshot and writes no log yet', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(400_000);
    h.store.getState().requestEnd();
    await h.store.getState().saveForLater();
    expect(h.store.getState()).toMatchObject({ status: 'ended', outcome: 'saved_for_later' });
    expect(h.getSnapshot()).not.toBeNull();
    expect(h.logs).toHaveLength(0);
  });

  it('End without saving clears the snapshot and logs an unfinished session over 60 s', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(400_000);
    h.store.getState().requestEnd();
    await h.store.getState().endWithoutSaving();
    expect(h.getSnapshot()).toBeNull();
    expect(h.logs[0]).toMatchObject({ status: 'unfinished', durationS: 400, movesDone: 2, movesPlanned: 5 });
  });

  it('does not log a session under 60 s', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(20_000);
    h.store.getState().requestEnd();
    await h.store.getState().endWithoutSaving();
    expect(h.logs).toHaveLength(0);
  });
});

describe('controls', () => {
  it('+15s rest during rest extends it; during work extends the next rest; caps at 90 s', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 10_000); // 10 s into move 1 work
    h.store.getState().addRest(30);
    const eff = effOf(h.store.getState());
    const rest = eff.find((e) => e.seg.kind === 'rest' && e.seg.stepIndex === 4)!;
    expect(rest.endMs - rest.startMs).toBe(50_000);
    for (let i = 0; i < 5; i += 1) h.store.getState().addRest(30);
    const rest2 = effOf(h.store.getState()).find((e) => e.seg.kind === 'rest' && e.seg.stepIndex === 4)!;
    expect(rest2.endMs - rest2.startMs).toBe(110_000); // 20 s + 90 s cap
    // total grows by exactly the extra
    expect(totalMs(effOf(h.store.getState()))).toBe(990_000);
    // running position is unchanged by the edit
    expect(deriveView(h.store.getState(), h.clock.now()).elapsedMs).toBe(142_000);
  });

  it('skip rest jumps to the end of the rest', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 40_000 + 5_000); // 5 s into rest
    expect(deriveView(h.store.getState(), h.clock.now()).kind).toBe('rest');
    h.store.getState().skipRest();
    const v = deriveView(h.store.getState(), h.clock.now());
    expect([v.kind, v.set]).toEqual(['work', 2]);
  });

  it('skip move goes to the closing rest, then the next move; skipped moves are not counted', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 5_000);
    h.store.getState().skipMove();
    let v = deriveView(h.store.getState(), h.clock.now());
    expect([v.kind, v.set]).toEqual(['rest', 2]);
    h.store.getState().skipMove();
    v = deriveView(h.store.getState(), h.clock.now());
    expect([v.kind, v.stepIndex]).toEqual(['transition', 5]);
    expect(h.store.getState().skipped).toEqual(['m0']);
    expect(movesDone(h.store.getState(), v.elapsedMs)).toBe(0);
  });

  it('previous restarts the current move after 3 s, otherwise goes back one', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 132_000 + 20_000); // inside move 2 (index 5)
    h.store.getState().previous();
    expect(deriveView(h.store.getState(), h.clock.now()).stepIndex).toBe(5);
    expect(deriveView(h.store.getState(), h.clock.now()).kind).toBe('transition');
    h.store.getState().previous(); // < 3 s in
    expect(deriveView(h.store.getState(), h.clock.now()).stepIndex).toBe(4);
  });

  it('rung change applies from the next set and keeps the total at 15:00', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 10_000); // move 1, set 1 work
    h.store.getState().setRung(1);
    const s = h.store.getState();
    expect(s.timeline!.totalS).toBe(900);
    const eff = effOf(s);
    const set1 = eff.filter((e) => e.seg.stepIndex === 4 && e.seg.set === 1 && e.seg.kind === 'work')[0]!;
    const set2 = eff.filter((e) => e.seg.stepIndex === 4 && e.seg.set === 2 && e.seg.kind === 'work')[0]!;
    expect(set1.endMs - set1.startMs).toBe(40_000);
    expect(set2.endMs - set2.startMs).toBe(45_000);
    expect(s.rungChanges).toEqual([{ stepIdx: 4, rung: 1 }]);
    // position did not move
    expect(deriveView(s, h.clock.now()).elapsedMs).toBe(142_000);
  });

  it('Feel answers change the next set and are recorded', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(120_000 + 12_000 + 10_000);
    h.store.getState().answerFeel('hard');
    expect(h.store.getState().rung).toBe(-1);
    expect(h.store.getState().feelSignals).toEqual([{ stepIdx: 4, value: 'hard' }]);
    h.store.getState().answerFeel('good');
    expect(h.store.getState().rung).toBe(-1);
  });
});

describe('feel prompt', () => {
  it('is raised once, in the rest after the middle move', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    // middle move is index 6 (third work move). Its closing rest starts at:
    const eff = effOf(h.store.getState());
    const rest = eff.filter((e) => e.seg.stepIndex === 6 && e.seg.kind === 'rest' && e.seg.set === 2)[0]!;
    h.advance(rest.startMs + 1000);
    expect(h.store.getState().feelPending).toBe(true);
    h.store.getState().openFeel();
    expect(h.store.getState().feelPending).toBe(false);
    h.advance(1000);
    expect(h.store.getState().feelPending).toBe(false);
  });

  it('is skipped for sessions under 8 minutes', () => {
    const h = createHarness();
    h.store.getState().start(makePlan({}, 3));
    expect(h.store.getState().timeline!.totalS).toBe(120 + 3 * 132 + 120);
    // 636 s total is over 8 min, so shorten the check with a micro plan instead
    const short = makePlan({}, 3);
    short.steps = short.steps.filter((s) => s.phase === 'work');
    h.store.getState().start(short);
    const rest = effOf(h.store.getState()).filter((e) => e.seg.stepIndex === 1 && e.seg.kind === 'rest' && e.seg.set === 2)[0]!;
    h.advance(rest.startMs + 1000);
    expect(h.store.getState().feelPending).toBe(false);
  });
});

describe('cues', () => {
  it('speaks step start, 10 s, 3-2-1, rest and up next, once each', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    expect(h.cues[0]).toMatchObject({ kind: 'step_start', name: 'Warm 0' });
    h.advance(20_000);
    expect(h.cues.map((c) => c.kind)).toContain('ten_seconds');
    h.advance(7_000); // 27 s: 3 s left
    h.advance(1_000);
    h.advance(1_000);
    const counts = h.cues.filter((c) => c.kind === 'count').map((c) => c.count);
    expect(counts).toEqual([3, 2, 1]);
    h.advance(250);
    h.advance(250);
    expect(h.cues.filter((c) => c.kind === 'count')).toHaveLength(3);
  });

  it('announces the side switch and up next after the last set', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    // move 2 (index 5) has sides each. Go to its set 2.
    const eff = effOf(h.store.getState());
    const left = eff.find((e) => e.seg.stepIndex === 5 && e.seg.kind === 'work' && e.seg.set === 2)!;
    h.advance(left.startMs + 500);
    expect(h.cues.some((c) => c.kind === 'switch_sides')).toBe(true);
    const last = eff.find((e) => e.seg.stepIndex === 5 && e.seg.kind === 'rest' && e.seg.set === 2)!;
    h.advance(last.startMs - left.startMs - 500 + 500);
    expect(h.cues.some((c) => c.kind === 'up_next' && c.name === 'Move 2')).toBe(true);
  });

  it('only the latest start cue plays after a long gap', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(25_000);
    const before = h.cues.length;
    // One late tick (9 s, inside the gap limit) that skips over a whole segment boundary.
    h.clock.advance(MAX_TICK_GAP_MS - 1000);
    h.store.getState().tick();
    expect(h.store.getState().status).toBe('active');
    expect(h.cues.length - before).toBe(1);
  });
});

describe('keep awake and services', () => {
  it('holds keep-awake while active and releases on pause and end', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    expect(h.keepAwake.active).toBe(true);
    h.store.getState().pause();
    expect(h.keepAwake.active).toBe(false);
    h.store.getState().resume();
    expect(h.keepAwake.active).toBe(true);
    h.advance(900_000);
    expect(h.keepAwake.active).toBe(false);
  });

  it('timeline located by the engine-shaped data is consistent', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    const eff = effOf(h.store.getState());
    expect(locate(eff, 0)?.seg.index).toBe(0);
    expect(locate(eff, 899_999)?.seg.index).toBe(eff.length - 1);
    expect(locate(eff, 900_000)).toBeNull();
    expect(getSessionDeps().clock.now()).toBe(h.clock.now());
  });
});

describe('active time', () => {
  it('does not count time while the app was not running (frozen process, emulator restore)', () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(60_000);
    // The process is frozen for 11 minutes; the first tick afterwards sees the jump.
    h.clock.advance(11 * 60_000);
    h.store.getState().tick();
    const s = h.store.getState();
    expect(s.status).toBe('paused');
    expect(s.pausedReason).toBe('background');
    expect(s.activeMs).toBe(60_000);
    expect(s.positionMs).toBe(60_000);
  });

  it('counts only active time across a snapshot and a restore much later', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(90_000);
    h.store.getState().pause('user');
    h.store.getState().reset();
    h.clock.advance(5 * 3600_000); // app closed for five hours
    expect(await h.store.getState().restoreFromSnapshot()).toBe(true);
    const s = h.store.getState();
    expect(s.status).toBe('paused');
    expect(s.activeMs).toBe(90_000);
    h.clock.advance(60_000); // still paused: nothing accrues
    h.store.getState().tick();
    expect(h.store.getState().activeMs).toBe(90_000);
    h.store.getState().resume();
    h.advance(30_000);
    h.store.getState().pause('user');
    expect(h.store.getState().activeMs).toBe(120_000);
  });

  it('restores an active snapshot (process killed) with only the time saved before the kill', async () => {
    const h = createHarness();
    h.store.getState().start(plan());
    h.advance(20_000);
    h.store.getState().reset();
    h.clock.advance(11 * 60_000);
    expect(await h.store.getState().restoreFromSnapshot()).toBe(true);
    expect(Math.floor(h.store.getState().activeMs / 60000)).toBe(0);
  });
});
