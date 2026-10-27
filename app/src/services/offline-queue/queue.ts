import { getOne, type SqlDriver, type SqlValue } from '../../db/driver';
import { newId } from './ids';
import { assertNoRawHealth } from './privacy';

export type QueueMethod = 'POST' | 'PUT' | 'DELETE';
export type QueueStatus = 'pending' | 'done' | 'dead';

export interface QueueItem {
  id: string;
  /** One key per logical attempt. Reused on every retry, so replays are safe. */
  idempotencyKey: string;
  kind: string;
  method: QueueMethod;
  path: string;
  body: unknown;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}

/**
 * Sends one item. Must put `Idempotency-Key: item.idempotencyKey` on the request
 * (see idempotencyHeaders). Resolve with the HTTP status; throw on network failure.
 */
export type QueueSender = (item: QueueItem) => Promise<{ status: number }>;

export interface FlushResult {
  sent: number;
  failed: number;
  dead: number;
  /** True if the flush stopped early (network error, 5xx, 429 or 401). */
  stopped: boolean;
}

export interface OfflineQueueOptions {
  now?: () => number;
  makeId?: () => string;
  /** True only when the user has turned health sync on. */
  healthSyncOn?: () => boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function idempotencyHeaders(item: Pick<QueueItem, 'idempotencyKey'>): Record<string, string> {
  return { 'Idempotency-Key': item.idempotencyKey, 'Content-Type': 'application/json' };
}

type Row = Record<string, SqlValue>;

const toItem = (r: Row): QueueItem => ({
  id: r.id as string,
  idempotencyKey: r.idempotency_key as string,
  kind: r.kind as string,
  method: r.method as QueueMethod,
  path: r.path as string,
  body: r.body_json === null ? undefined : JSON.parse(r.body_json as string),
  status: r.status as QueueStatus,
  attempts: r.attempts as number,
  nextAttemptAt: r.next_attempt_at as number,
  lastError: r.last_error as string | null,
  createdAt: r.created_at as number,
});

export class OfflineQueue {
  private inFlight: Promise<FlushResult> | null = null;
  private readonly now: () => number;
  private readonly makeId: () => string;
  private readonly healthSyncOn: () => boolean;
  private readonly maxAttempts: number;
  private readonly base: number;
  private readonly cap: number;

  constructor(
    private readonly d: SqlDriver,
    o: OfflineQueueOptions = {},
  ) {
    this.now = o.now ?? Date.now;
    this.makeId = o.makeId ?? newId;
    this.healthSyncOn = o.healthSyncOn ?? (() => false);
    this.maxAttempts = o.maxAttempts ?? 8;
    this.base = o.baseDelayMs ?? 5_000;
    this.cap = o.maxDelayMs ?? 60 * 60_000;
  }

  /**
   * Adds a request. Pass an idempotencyKey you already used (for example the one
   * spent locally for a form check) to keep server and phone in step; enqueueing
   * the same key twice returns the first item and never duplicates.
   */
  async enqueue(req: {
    kind: string;
    method: QueueMethod;
    path: string;
    body?: unknown;
    idempotencyKey?: string;
  }): Promise<QueueItem> {
    assertNoRawHealth(req.body, this.healthSyncOn());
    const key = req.idempotencyKey ?? this.makeId();
    const existing = await getOne<Row>(this.d, 'SELECT * FROM offline_queue WHERE idempotency_key = ?', [key]);
    if (existing) return toItem(existing);
    const id = this.makeId();
    const t = this.now();
    await this.d.transaction(async () => {
      const m = await getOne<{ m: number | null }>(this.d, 'SELECT MAX(seq) AS m FROM offline_queue');
      await this.d.run(
        `INSERT INTO offline_queue (id, idempotency_key, kind, method, path, body_json, status, attempts,
          next_attempt_at, created_at, seq) VALUES (?,?,?,?,?,?, 'pending', 0, ?, ?, ?)`,
        [id, key, req.kind, req.method, req.path,
          req.body === undefined ? null : JSON.stringify(req.body), t, t, (m?.m ?? 0) + 1],
      );
    });
    return toItem((await getOne<Row>(this.d, 'SELECT * FROM offline_queue WHERE id = ?', [id]))!);
  }

  async pending(): Promise<QueueItem[]> {
    return (await this.d.all<Row>("SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY seq")).map(toItem);
  }

  async dead(): Promise<QueueItem[]> {
    return (await this.d.all<Row>("SELECT * FROM offline_queue WHERE status = 'dead' ORDER BY seq")).map(toItem);
  }

  /** Drops finished items older than olderThanMs. Dead items are kept for support. */
  async pruneDone(olderThanMs: number): Promise<void> {
    await this.d.run("DELETE FROM offline_queue WHERE status = 'done' AND created_at < ?", [
      this.now() - olderThanMs,
    ]);
  }

  /** Concurrent callers share one run, so an item is never sent twice at once. */
  flush(send: QueueSender): Promise<FlushResult> {
    if (!this.inFlight) {
      this.inFlight = this.run(send).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async run(send: QueueSender): Promise<FlushResult> {
    const res: FlushResult = { sent: 0, failed: 0, dead: 0, stopped: false };
    const queued = await this.pending();

    for (const item of queued) {
      if (item.nextAttemptAt > this.now()) {
        // An earlier item is still backing off: later ones wait their turn.
        res.stopped = true;
        break;
      }
      let status: number | null = null;
      let error: string | null = null;
      try {
        status = (await send(item)).status;
      } catch (e) {
        error = e instanceof Error ? e.message : 'network error';
      }

      if (status !== null && ((status >= 200 && status < 300) || status === 409)) {
        // 409 on an idempotent replay means the server already holds this attempt.
        await this.d.run("UPDATE offline_queue SET status = 'done', last_error = NULL WHERE id = ?", [item.id]);
        res.sent++;
        continue;
      }
      if (status === 401) {
        // Needs a fresh sign-in, not a failed attempt: leave it as is and stop.
        res.stopped = true;
        break;
      }
      const retryable = status === null || status === 408 || status === 429 || status >= 500;
      const attempts = item.attempts + 1;
      const msg = error ?? `HTTP ${status}`;
      if (!retryable || attempts >= this.maxAttempts) {
        await this.d.run(
          "UPDATE offline_queue SET status = 'dead', attempts = ?, last_error = ? WHERE id = ?",
          [attempts, msg, item.id],
        );
        res.dead++;
        if (!retryable) continue; // a bad request does not block the ones behind it
        res.stopped = true;
        break;
      }
      const delay = Math.min(this.cap, this.base * 2 ** (attempts - 1));
      await this.d.run(
        'UPDATE offline_queue SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?',
        [attempts, msg, this.now() + delay, item.id],
      );
      res.failed++;
      res.stopped = true; // keep order: do not leapfrog a failing item
      break;
    }
    return res;
  }
}
