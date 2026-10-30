import { createEngine, evaluateFraming } from './engine';
import { lungeSequence, plankSequence, pushUpSequence, squatSequence } from './synthetic';
import type { EngineEvent, FormExercise, PoseFrame } from './types';

function run(exercise: FormExercise, frames: PoseFrame[]) {
  const engine = createEngine(exercise);
  const events: EngineEvent[] = [];
  for (const f of frames) events.push(...engine.push(f));
  return { engine, events, summary: engine.summary() };
}
const reps = (e: EngineEvent[]) => e.filter((x): x is Extract<EngineEvent, { k: 'rep' }> => x.k === 'rep');
const count = (e: EngineEvent[], k: EngineEvent['k']) => e.filter((x) => x.k === k).length;

describe('squat', () => {
  it('counts clean reps, rates them good and fires counted once at rep 3', () => {
    const { events, summary } = run('squat', squatSequence({ reps: 5 }));
    expect(reps(events)).toHaveLength(5);
    expect(reps(events).every((r) => r.ok)).toBe(true);
    expect(count(events, 'counted')).toBe(1);
    const i = events.findIndex((x) => x.k === 'counted');
    expect(reps(events.slice(0, i))).toHaveLength(3);
    expect(summary).toMatchObject({ repsAnalysed: 5, repsClean: 5, rating: 'good' });
    expect(summary.findings.every((f) => f.status === 'ok')).toBe(true);
  });

  it('does not fire counted before three reps', () => {
    const { events } = run('squat', squatSequence({ reps: 2 }));
    expect(reps(events)).toHaveLength(2);
    expect(count(events, 'counted')).toBe(0);
  });

  it('flags shallow, leaning reps (bad form) and rates needs work', () => {
    const { events, summary } = run('squat', squatSequence({ reps: 4, minKnee: 108, lean: 70 }));
    expect(reps(events)).toHaveLength(4);
    expect(reps(events).every((r) => !r.ok && r.issues.includes('depth') && r.issues.includes('back'))).toBe(true);
    expect(summary.rating).toBe('needs_work');
    expect(summary.findings.find((f) => f.area === 'depth')?.status).toBe('warn');
    expect(summary.perRep[0]).toMatchObject({ ok: false, issue: 'depth' });
  });

  it('copes with 8 Hz input and landmark jitter', () => {
    const { events } = run('squat', squatSequence({ reps: 4, hz: 8, noise: 0.003 }));
    expect(reps(events)).toHaveLength(4);
    expect(reps(events).every((r) => r.ok)).toBe(true);
  });

  it('freezes on a short occlusion and keeps counting', () => {
    // Hidden for 0.5 s during the second rep: under the 1 s limit, so nothing is lost.
    const { events } = run('squat', squatSequence({ reps: 4, dropouts: [{ fromMs: 1200 + 2400 + 900, toMs: 1200 + 2400 + 1400 }] }));
    expect(reps(events)).toHaveLength(4);
    expect(events.some((e) => e.k === 'framing' && e.hint === 'lost')).toBe(false);
  });

  it('drops the rep in flight as unscored after more than 1 s of occlusion, then recovers', () => {
    // Hidden for 1.6 s across the bottom of rep 2, which is in flight.
    const from = 1200 + 2400 + 900;
    const { events } = run('squat', squatSequence({ reps: 5, dropouts: [{ fromMs: from, toMs: from + 1600 }] }));
    expect(events.some((e) => e.k === 'framing' && !e.ok && e.hint === 'lost')).toBe(true);
    expect(count(events, 'unscored')).toBe(1);
    // Rep 2 is dropped, and rep 3 starts before the person is standing again (the engine re-arms
    // only after 300 ms upright), so reps 1, 4 and 5 are counted.
    expect(reps(events)).toHaveLength(3);
    expect(events.some((e) => e.k === 'framing' && e.ok)).toBe(true);
  });

  it('asks for a step closer when the body is too small, and a step back at the edge', () => {
    const small = squatSequence({ reps: 1, scale: 0.3 })[0]!;
    expect(evaluateFraming(small, 'squat')).toMatchObject({ ok: false, hint: 'closer' });
    const ok = squatSequence({ reps: 1 })[0]!;
    expect(evaluateFraming(ok, 'squat').ok).toBe(true);
    const wide = squatSequence({ reps: 1, scale: 1.6 })[0]!;
    expect(evaluateFraming(wide, 'squat')).toMatchObject({ ok: false, hint: 'back' });
  });

  it('ignores NaN frames and out-of-order timestamps', () => {
    const frames = squatSequence({ reps: 3 });
    const bad: PoseFrame = { t: 500, lm: frames[0]!.lm.map(() => ({ x: NaN, y: NaN, v: NaN })) };
    const engine = createEngine('squat');
    expect(() => engine.push(bad)).not.toThrow();
    const events = frames.flatMap((f) => engine.push(f));
    expect(reps(events)).toHaveLength(3);
    expect(engine.push({ ...frames[0]!, t: 0 })).toEqual([]);
  });

  it('keeps no frame data after reset', () => {
    const { engine } = run('squat', squatSequence({ reps: 2 }));
    expect(engine.holdsFrameData()).toBe(true);
    engine.reset();
    expect(engine.holdsFrameData()).toBe(false);
    expect(engine.summary().repsAnalysed).toBe(0);
  });
});

describe('push-up', () => {
  it('counts clean reps', () => {
    const { events, summary } = run('push_up', pushUpSequence({ reps: 5 }));
    expect(reps(events)).toHaveLength(5);
    expect(summary.rating).toBe('good');
    expect(count(events, 'counted')).toBe(1);
  });

  it('flags half reps and a sagging body', () => {
    const { events, summary } = run('push_up', pushUpSequence({ reps: 4, minElbow: 108, sag: 0.1 }));
    expect(reps(events)).toHaveLength(4);
    expect(reps(events).every((r) => !r.ok && r.issues.includes('elbows') && r.issues.includes('hips'))).toBe(true);
    expect(summary.rating).toBe('needs_work');
  });

  it('does not count while the body is not in a plank position', () => {
    // Standing figure (squat) scored as a push-up: wrong posture, nothing counted.
    const { events } = run('push_up', squatSequence({ reps: 4 }));
    expect(reps(events)).toHaveLength(0);
  });
});

describe('plank', () => {
  it('fires counted at 10 s of hold, not at 8 s', () => {
    expect(count(run('plank', plankSequence({ seconds: 8 })).events, 'counted')).toBe(0);
    const twelve = run('plank', plankSequence({ seconds: 12 }));
    expect(count(twelve.events, 'counted')).toBe(1);
    expect(twelve.summary.holdSeconds).toBeGreaterThanOrEqual(11);
    expect(twelve.summary).toMatchObject({ rating: 'good', exercise: 'plank' });
    expect(twelve.events.some((e) => e.k === 'hold')).toBe(true);
  });

  it('bridges a 0.5 s dropout but a 2 s dropout restarts the hold', () => {
    const bridged = run('plank', plankSequence({ seconds: 12, dropouts: [{ fromMs: 5000, toMs: 5500 }] }));
    expect(count(bridged.events, 'counted')).toBe(1);
    const broken = run('plank', plankSequence({ seconds: 12, dropouts: [{ fromMs: 5000, toMs: 7000 }] }));
    expect(count(broken.events, 'counted')).toBe(0);
  });

  it('a sagging hip never holds and rates needs work', () => {
    const { events, summary } = run('plank', plankSequence({ seconds: 12, sag: 0.12 }));
    expect(count(events, 'counted')).toBe(0);
    expect(summary.rating).toBe('needs_work');
    expect(summary.findings.find((f) => f.area === 'hips')?.status).toBe('warn');
  });
});

describe('lunge', () => {
  it('counts clean reps, with alternating legs', () => {
    const { events, summary } = run('lunge', lungeSequence({ reps: 6, alternate: true }));
    expect(reps(events)).toHaveLength(6);
    expect(reps(events).every((r) => r.ok)).toBe(true);
    expect(summary.rating).toBe('good');
    expect(count(events, 'counted')).toBe(1);
  });

  it('flags a shallow, leaning lunge', () => {
    const { events, summary } = run('lunge', lungeSequence({ reps: 4, minKnee: 108, trunk: 40 }));
    expect(reps(events)).toHaveLength(4);
    expect(reps(events).every((r) => !r.ok && r.issues.includes('depth') && r.issues.includes('back'))).toBe(true);
    expect(summary.rating).toBe('needs_work');
  });
});
