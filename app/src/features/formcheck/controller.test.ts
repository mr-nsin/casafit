import { ApiError, NetworkError } from '../../api/client';
import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import { createUnavailableSource, type PoseFrame, type PoseSource } from '../../services/pose';
import { lungeSequence, plankSequence, squatSequence } from '../../services/pose/synthetic';
import { setRepositories } from '../../state/storage';
import { useAuth } from '../../state/auth';
import { configureFormCheckDeps } from './deps';
import { useEntitlements } from './entitlements';
import { useFormCheck } from './controller';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const NOW = Date.UTC(2026, 9, 30);
let db: Awaited<ReturnType<typeof createTestDb>>;
const api = jest.fn();
const enqueue = jest.fn(async () => undefined);
const flush = jest.fn(async () => undefined);
let push: (f: PoseFrame) => void;
const stop = jest.fn();
let source: PoseSource;
let n = 0;

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const feed = async (frames: PoseFrame[]) => {
  for (const f of frames) push(f);
  await settle();
};
const attempt = async () => (await db.repos.formCheck.get(useFormCheck.getState().attemptId!))!;

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  api.mockReset();
  enqueue.mockClear();
  flush.mockClear();
  stop.mockClear();
  n = 0;
  source = {
    kind: 'simulated',
    available: true,
    start: (cb) => {
      push = cb;
    },
    stop,
  };
  configureFormCheckDeps({
    api: api as never,
    enqueue: enqueue as never,
    flush,
    repos: () => db.repos,
    now: () => NOW,
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    poseSource: () => source,
  });
  useAuth.setState({ freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  useEntitlements.setState({ hydrated: true, freeChecks: 2, pro: null, offline: false, proChecksThisMonth: 0 });
  useFormCheck.getState().reset();
  useFormCheck.getState().select('squat');
});
afterEach(() => {
  useFormCheck.getState().reset();
  configureFormCheckDeps(null);
  setRepositories(null);
  db.driver.close();
});

describe('start', () => {
  it('writes the attempt to the phone before any network call', async () => {
    api.mockImplementation(() => new Promise(() => undefined));
    expect(await useFormCheck.getState().start()).toBe('started');
    const a = await attempt();
    expect(a).toMatchObject({ exercise: 'squat', state: 'armed', idempotencyKey: '00000000-0000-4000-8000-000000000002' });
    expect(api).not.toHaveBeenCalled();
    expect(useFormCheck.getState().phase).toBe('running');
  });

  it('with no pose source it reports unavailable, creates no attempt and spends nothing', async () => {
    source = createUnavailableSource('native_module_missing');
    expect(await useFormCheck.getState().start()).toBe('unavailable');
    expect(useFormCheck.getState().phase).toBe('unavailable');
    expect(useFormCheck.getState().attemptId).toBeNull();
    expect(n).toBe(0);
    expect(api).not.toHaveBeenCalled();
  });

  it('survives a source that throws on start', async () => {
    source = { ...source, start: () => { throw new Error('camera busy'); } };
    expect(await useFormCheck.getState().start()).toBe('unavailable');
    expect(api).not.toHaveBeenCalled();
  });
});

describe('spending', () => {
  it('consumes once at rep 3 with the attempt key, and keeps the server balance', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 5 }));
    expect(api).toHaveBeenCalledTimes(1);
    const [path, init] = api.mock.calls[0]!;
    const a = await attempt();
    expect(path).toBe('/entitlements/form-check/consume');
    expect(JSON.parse(init.body)).toEqual({ idempotencyKey: a.idempotencyKey, exercise: 'squat' });
    expect(init.headers['Idempotency-Key']).toBe(a.idempotencyKey);
    expect(a.state).toBe('spent');
    expect(useFormCheck.getState()).toMatchObject({ phase: 'counted', spend: 'spent', reps: 5 });
    expect(useEntitlements.getState().freeChecks).toBe(1);
    expect(useAuth.getState().freeChecksRemaining).toBe(1);
  });

  it('does not consume before rep 3', async () => {
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 2 }));
    expect(api).not.toHaveBeenCalled();
    expect((await attempt()).state).toBe('armed');
  });

  it('offline: spends from the cache and queues the SAME key', async () => {
    api.mockRejectedValue(new NetworkError());
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 3 }));
    const a = await attempt();
    expect(a.state).toBe('spent_local');
    expect(useFormCheck.getState().spend).toBe('local');
    expect(useEntitlements.getState().freeChecks).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({
      kind: 'form_check.consume',
      method: 'POST',
      path: '/entitlements/form-check/consume',
      body: { idempotencyKey: a.idempotencyKey, exercise: 'squat' },
      idempotencyKey: a.idempotencyKey,
    });
    expect(flush).toHaveBeenCalled();
  });

  it('a server error queues the same key too', async () => {
    api.mockRejectedValue(new ApiError(503, null));
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 3 }));
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(useFormCheck.getState().spend).toBe('local');
  });

  it('server says no credit left: keeps the result, marks would-have-been-charged, balance 0', async () => {
    api.mockResolvedValue({ ok: false, reason: 'no_credits' });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 3 }));
    expect(await attempt()).toMatchObject({ state: 'spent_local', wouldHaveBeenCharged: true });
    expect(useFormCheck.getState().spend).toBe('overdrawn');
    expect(useEntitlements.getState().freeChecks).toBe(0);
  });

  it('never goes below zero offline', async () => {
    api.mockRejectedValue(new NetworkError());
    useEntitlements.setState({ freeChecks: 0 });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 3 }));
    expect(useEntitlements.getState().freeChecks).toBe(0);
  });

  it('Pro skips consume entirely and counts the month', async () => {
    useEntitlements.setState({
      pro: { active: true, plan: 'pro_yearly', expiresAt: NOW + 1e9, willRenew: true, billingIssue: false, trial: false, priceString: null, verifiedAt: NOW },
    });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 4 }));
    expect(api).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect((await attempt()).state).toBe('spent');
    expect(useFormCheck.getState().spend).toBe('pro');
    expect(useEntitlements.getState().proChecksThisMonth).toBe(1);
  });

  it('the plank counts at a 10 second hold, not at reps', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    useFormCheck.getState().select('plank');
    await useFormCheck.getState().start();
    const frames = plankSequence({ seconds: 14 });
    await feed(frames.filter((f) => f.t <= 1000 + 8000));
    expect(api).not.toHaveBeenCalled();
    await feed(frames.filter((f) => f.t > 1000 + 8000));
    expect(api).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.mock.calls[0]![1].body).exercise).toBe('plank');
  });
});

describe('closing', () => {
  it('before rep 3: cancels with no spend and no queue entry, and stops the camera', async () => {
    await useFormCheck.getState().start();
    const id = useFormCheck.getState().attemptId!;
    await feed(squatSequence({ reps: 2 }));
    await useFormCheck.getState().cancel();
    expect(api).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect((await db.repos.formCheck.get(id))!.state).toBe('cancelled');
    expect(stop).toHaveBeenCalled();
    expect(useFormCheck.getState()).toMatchObject({ phase: 'idle', attemptId: null, reps: 0 });
    expect(useEntitlements.getState().freeChecks).toBe(2);
  });

  it('finish before the count point is a cancel, not a result', async () => {
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 1 }));
    expect(await useFormCheck.getState().finish()).toBeNull();
    expect(useFormCheck.getState().result).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('cancel after the check counted is a no-op: it stays spent', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 3 }));
    await useFormCheck.getState().cancel();
    expect((await attempt()).state).toBe('spent');
    expect(useFormCheck.getState().phase).toBe('counted');
  });

  it('finish builds a result in memory only, waits for the spend, and stops the source', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 5 }));
    const r = await useFormCheck.getState().finish();
    expect(r).toMatchObject({ exercise: 'squat', repsAnalysed: 5, repsClean: 5, rating: 'good', spend: 'spent', creditsLeft: 1 });
    expect(r!.findings.map((f) => f.area)).toEqual(['depth', 'knees', 'back']);
    expect(useFormCheck.getState().phase).toBe('done');
    expect(stop).toHaveBeenCalled();
    // The attempt journal holds state and key only: no reps, ratings or landmarks.
    expect(Object.keys(await attempt()).sort()).toEqual(['exercise', 'id', 'idempotencyKey', 'spentAt', 'startedAt', 'state', 'wouldHaveBeenCharged']);
  });

  it('bad form gives a gentle tip and the needs-work rating', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 4, minKnee: 108, lean: 70 }));
    const r = await useFormCheck.getState().finish();
    expect(r!.rating).toBe('needs_work');
    expect(r!.findings.find((f) => f.area === 'depth')).toMatchObject({ status: 'warn' });
    expect(r!.tip).toMatch(/lower|sit/i);
  });

  it('gives one cue per faulty rep and none for clean reps', async () => {
    await useFormCheck.getState().start();
    await feed(squatSequence({ reps: 2, minKnee: 108 }));
    expect(useFormCheck.getState().cue).toBe('A little deeper');
    expect(useFormCheck.getState().cueSeq).toBe(2);
  });

  it('the lunge runs through the same machine', async () => {
    api.mockResolvedValue({ ok: true, freeChecksRemaining: 1 });
    useFormCheck.getState().select('lunge');
    await useFormCheck.getState().start();
    await feed(lungeSequence({ reps: 3 }));
    expect(JSON.parse(api.mock.calls[0]![1].body).exercise).toBe('lunge');
  });
});
