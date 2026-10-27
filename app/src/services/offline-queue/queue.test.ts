import { createNodeSqliteDriver } from '../../db/testing/nodeSqliteDriver';
import { runMigrations } from '../../db/migrations';
import { OfflineQueue, idempotencyHeaders, type QueueItem } from './queue';
import { HealthDataLeakError } from './privacy';

let driver: ReturnType<typeof createNodeSqliteDriver>;
let t = 1_000_000;
let ids = 0;
let q: OfflineQueue;
let healthSync = false;

beforeEach(async () => {
  driver = createNodeSqliteDriver();
  await runMigrations(driver);
  t = 1_000_000;
  ids = 0;
  healthSync = false;
  q = new OfflineQueue(driver, { now: () => t, makeId: () => `id${++ids}`, healthSyncOn: () => healthSync });
});
afterEach(() => driver.close());

const req = (over = {}) => ({ kind: 'plan', method: 'PUT' as const, path: '/v1/me/plan', body: { variant: 'standard' }, ...over });

describe('enqueue', () => {
  it('assigns one key per attempt and dedupes a repeated key', async () => {
    const a = await q.enqueue(req());
    const b = await q.enqueue(req({ idempotencyKey: a.idempotencyKey }));
    expect(b.id).toBe(a.id);
    expect(await q.pending()).toHaveLength(1);
    const c = await q.enqueue(req());
    expect(c.idempotencyKey).not.toBe(a.idempotencyKey);
  });

  it('accepts a caller key, for a credit spent locally with the same key', async () => {
    const a = await q.enqueue(req({ kind: 'consume', method: 'POST', path: '/v1/entitlements/consume', body: {}, idempotencyKey: 'attempt-9' }));
    expect(a.idempotencyKey).toBe('attempt-9');
  });

  it('refuses raw health answers unless health sync is on (D3)', async () => {
    await expect(q.enqueue(req({ body: { variant: 'gentler', painAreas: ['knees'] } }))).rejects.toBeInstanceOf(HealthDataLeakError);
    await expect(q.enqueue(req({ body: { nested: [{ health_flags: ['heart_bp'] }] } }))).rejects.toThrow(/health_flags/);
    expect(await q.pending()).toHaveLength(0);
    healthSync = true;
    await expect(q.enqueue(req({ body: { flags: ['heart_bp'] } }))).resolves.toBeDefined();
  });

  it('allows the derived plan fields D3 permits', async () => {
    await expect(
      q.enqueue(req({ body: { goal: 'stay_fit', styles: 1, daysPerWeek: 4, experience: 'new', variant: 'gentler' } })),
    ).resolves.toBeDefined();
  });
});

describe('flush', () => {
  it('sends in order with the same key on every retry, then marks done', async () => {
    const a = await q.enqueue(req({ path: '/a' }));
    await q.enqueue(req({ path: '/b' }));
    const seen: [string, string][] = [];
    let fail = true;
    const send = async (i: QueueItem) => {
      seen.push([i.path, idempotencyHeaders(i)['Idempotency-Key']!]);
      if (fail) throw new Error('offline');
      return { status: 200 };
    };
    let r = await q.flush(send);
    expect(r).toMatchObject({ sent: 0, failed: 1, stopped: true });
    expect(seen).toEqual([['/a', a.idempotencyKey]]); // /b did not leapfrog

    r = await q.flush(send); // backoff not elapsed
    expect(r.sent).toBe(0);
    expect(seen).toHaveLength(1);

    t += 5_000;
    fail = false;
    r = await q.flush(send);
    expect(r.sent).toBe(2);
    expect(seen.filter(([p]) => p === '/a').map(([, k]) => k)).toEqual([a.idempotencyKey, a.idempotencyKey]);
    expect(await q.pending()).toHaveLength(0);
  });

  it('backs off exponentially and caps', async () => {
    const small = new OfflineQueue(driver, { now: () => t, makeId: () => `z${++ids}`, baseDelayMs: 1000, maxDelayMs: 3000, maxAttempts: 50 });
    await small.enqueue(req());
    const send = async () => ({ status: 503 });
    await small.flush(send);
    expect((await small.pending())[0]?.nextAttemptAt).toBe(t + 1000);
    t += 1000;
    await small.flush(send);
    expect((await small.pending())[0]?.nextAttemptAt).toBe(t + 2000);
    t += 2000;
    await small.flush(send);
    expect((await small.pending())[0]?.nextAttemptAt).toBe(t + 3000); // capped
  });

  it('treats 409 on replay as already applied', async () => {
    await q.enqueue(req());
    const r = await q.flush(async () => ({ status: 409 }));
    expect(r.sent).toBe(1);
    expect(await q.pending()).toHaveLength(0);
  });

  it('kills a 4xx item without blocking those behind it', async () => {
    await q.enqueue(req({ path: '/bad' }));
    await q.enqueue(req({ path: '/ok' }));
    const r = await q.flush(async (i) => ({ status: i.path === '/bad' ? 422 : 200 }));
    expect(r).toMatchObject({ sent: 1, dead: 1, stopped: false });
    expect((await q.dead())[0]?.lastError).toBe('HTTP 422');
  });

  it('goes dead after max attempts', async () => {
    const small = new OfflineQueue(driver, { now: () => t, makeId: () => `y${++ids}`, maxAttempts: 2, baseDelayMs: 1 });
    await small.enqueue(req());
    const send = async () => ({ status: 500 });
    await small.flush(send);
    t += 10;
    const r = await small.flush(send);
    expect(r.dead).toBe(1);
    expect(await small.pending()).toHaveLength(0);
  });

  it('401 stops without spending an attempt', async () => {
    await q.enqueue(req());
    const r = await q.flush(async () => ({ status: 401 }));
    expect(r.stopped).toBe(true);
    const [i] = await q.pending();
    expect(i?.attempts).toBe(0);
  });

  it('concurrent flushes share one run so nothing is sent twice', async () => {
    await q.enqueue(req());
    let calls = 0;
    const send = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { status: 200 };
    };
    await Promise.all([q.flush(send), q.flush(send), q.flush(send)]);
    expect(calls).toBe(1);
  });

  it('survives a crash after send but before mark: replays with the same key', async () => {
    const a = await q.enqueue(req());
    const keys: string[] = [];
    // First run: sender succeeds but the DB write is lost (simulated by resetting status).
    await q.flush(async (i) => (keys.push(i.idempotencyKey), { status: 200 }));
    await driver.run("UPDATE offline_queue SET status = 'pending'");
    await q.flush(async (i) => (keys.push(i.idempotencyKey), { status: 200 }));
    expect(keys).toEqual([a.idempotencyKey, a.idempotencyKey]);
  });

  it('persists across a new queue instance on the same database', async () => {
    await q.enqueue(req());
    const q2 = new OfflineQueue(driver, { now: () => t });
    expect(await q2.pending()).toHaveLength(1);
  });
});
