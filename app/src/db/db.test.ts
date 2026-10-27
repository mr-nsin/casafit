import { getTableColumns, getTableName } from 'drizzle-orm';
import { MIGRATIONS, runMigrations } from './migrations';
import { tables } from './schema';
import type { Repositories } from './repositories';
import { createNodeSqliteDriver, createTestDb } from './testing/nodeSqliteDriver';

let repos: Repositories;
let driver: ReturnType<typeof createNodeSqliteDriver>;
beforeEach(async () => {
  ({ repos, driver } = await createTestDb());
});
afterEach(() => driver.close());

const log = (over: Partial<Parameters<Repositories['sessionLog']['insert']>[0]> = {}) => ({
  id: 's1', planWeek: 1, planDay: 0, style: 'normal' as const, status: 'complete' as const,
  durationS: 900, movesDone: 8, movesPlanned: 8, felt: 'about_right' as const, rungChanges: [],
  feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: 1000, ...over,
});

describe('migrations and schema', () => {
  it('is idempotent', async () => {
    expect(await runMigrations(driver)).toBe(0);
    const rows = await driver.all('SELECT id FROM schema_migration');
    expect(rows).toHaveLength(MIGRATIONS.length);
  });

  it('Drizzle schema mirrors the migrated tables column for column', async () => {
    for (const t of Object.values(tables)) {
      const name = getTableName(t);
      const actual = (await driver.all<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name).sort();
      const declared = Object.values(getTableColumns(t)).map((c) => c.name).sort();
      expect({ name, cols: declared }).toEqual({ name, cols: actual });
    }
  });

  it('rolls a failed migration back', async () => {
    const d = createNodeSqliteDriver();
    await expect(
      d.transaction(async () => {
        await d.run('CREATE TABLE x (a INTEGER)');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await d.all("SELECT name FROM sqlite_master WHERE name = 'x'")).toHaveLength(0);
    d.close();
  });
});

describe('session_log', () => {
  it('stores complete and unfinished with felt', async () => {
    await repos.sessionLog.insert(log());
    await repos.sessionLog.insert(log({ id: 's2', status: 'unfinished', felt: null, movesDone: 3, durationS: 40 }));
    expect((await repos.sessionLog.list({ status: 'unfinished' })).map((l) => l.id)).toEqual(['s2']);
    expect((await repos.sessionLog.list({ status: 'complete' }))[0]?.felt).toBe('about_right');
  });

  it('rejects values outside the status and felt enums', async () => {
    await expect(repos.sessionLog.insert(log({ id: 'bad', status: 'done' as never }))).rejects.toThrow();
    await expect(repos.sessionLog.insert(log({ id: 'bad2', felt: 'meh' as never }))).rejects.toThrow();
  });

  it('replaying the same id is a no-op', async () => {
    expect(await repos.sessionLog.insert(log())).toBe(true);
    expect(await repos.sessionLog.insert(log({ durationS: 1 }))).toBe(false);
    const all = await repos.sessionLog.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.durationS).toBe(900);
  });

  it('tracks sync state', async () => {
    await repos.sessionLog.insert(log());
    expect(await repos.sessionLog.unsynced()).toHaveLength(1);
    await repos.sessionLog.markSynced(['s1'], 5);
    expect(await repos.sessionLog.unsynced()).toHaveLength(0);
  });
});

describe('snapshot (24 h resume)', () => {
  it('loads before expiry and drops after', async () => {
    await repos.snapshot.save({
      planDayWeek: 1, planDayIndex: 2, startedAt: 0, stateJson: '{}', snapshotAt: 0, expiresAt: 100,
    });
    expect((await repos.snapshot.load(99))?.planDayIndex).toBe(2);
    expect(await repos.snapshot.load(100)).toBeNull();
    expect(await repos.snapshot.load(0)).toBeNull(); // already deleted
  });
});

describe('food, steps, micro, favourites', () => {
  it('food: add idempotent, day query, recents, edit resets sync', async () => {
    const e = { id: 'f1', loggedOn: '2026-10-27', meal: 'lunch' as const, foodId: 'dal', unit: 'katori',
      portions: 1.5, snapshot: { kcal: 150, proteinG: 7, packVersion: 1 }, createdAt: 1 };
    expect(await repos.food.add(e)).toBe(true);
    expect(await repos.food.add(e)).toBe(false);
    await repos.food.add({ ...e, id: 'f2', foodId: 'roti', createdAt: 2, snapshot: null });
    expect((await repos.food.forDay('2026-10-27')).map((x) => x.id)).toEqual(['f1', 'f2']);
    expect(await repos.food.recentFoodIds(5)).toEqual(['roti', 'dal']);
    await repos.food.markSynced(['f1'], 9);
    await repos.food.update('f1', { portions: 2 });
    expect((await repos.food.unsynced()).map((x) => x.id)).toContain('f1');
    await expect(repos.food.add({ ...e, id: 'f3', portions: 0 })).rejects.toThrow();
  });

  it('steps: upsert replaces and re-queues for sync; purge clears bouts too', async () => {
    await repos.steps.upsert({ onDate: '2026-10-27', steps: 100, briskMinutes: 1, source: 'pedometer', updatedAt: 1 });
    await repos.steps.markSynced(['2026-10-27'], 2);
    await repos.steps.upsert({ onDate: '2026-10-27', steps: 200, briskMinutes: 2, source: 'pedometer', updatedAt: 3 });
    expect((await repos.steps.unsynced())[0]?.steps).toBe(200);
    await repos.steps.startBout({ id: 'b', startedAt: 5 });
    await repos.steps.endBout('b', 9, 40, 'user');
    expect((await repos.steps.boutsSince(0))[0]).toMatchObject({ steps: 40, stoppedBy: 'user' });
    await repos.steps.purge();
    expect(await repos.steps.range('2000-01-01', '2100-01-01')).toHaveLength(0);
    expect(await repos.steps.boutsSince(0)).toHaveLength(0);
  });

  it('micro sessions add to active seconds and never to session_log', async () => {
    await repos.micro.insert({ id: 'm1', planId: 'desk', activeS: 120, at: 10 });
    expect(await repos.micro.insert({ id: 'm1', planId: 'desk', activeS: 120, at: 10 })).toBe(false);
    expect(await repos.micro.totalActiveS(0)).toBe(120);
    expect(await repos.sessionLog.list()).toHaveLength(0);
  });

  it('favourites toggle', async () => {
    expect(await repos.favourites.toggle('squat', 1)).toBe(true);
    expect(await repos.favourites.toggle('squat', 2)).toBe(false);
    expect(await repos.favourites.all()).toEqual([]);
  });
});

describe('profile, plan, nutrition, misc', () => {
  it('profile save merges patches', async () => {
    await repos.profile.save({ heightCm: 162, painAreas: ['knees'] });
    const p = await repos.profile.save({ weightKg: 60 });
    expect(p).toMatchObject({ heightCm: 162, weightKg: 60, painAreas: ['knees'], stepGoal: 7000, onboarded: false });
    expect((await repos.profile.get())?.painAreas).toEqual(['knees']);
  });

  it('plan save clears synced flag; days replace per week', async () => {
    const p = { goal: 'stay_fit' as const, bodyParts: [], styles: ['normal' as const], mix: {}, daysPerWeek: 4,
      experience: 'new' as const, variant: 'standard' as const, weekNumber: 1, engineVersion: '1' };
    await repos.plan.save(p);
    await repos.plan.markSynced(5);
    expect((await repos.plan.get())?.syncedAt).toBe(5);
    await repos.plan.save({ ...p, daysPerWeek: 5 });
    expect((await repos.plan.get())).toMatchObject({ daysPerWeek: 5, syncedAt: null });
    await expect(repos.plan.save({ ...p, daysPerWeek: 2 })).rejects.toThrow();
    const day = { planWeek: 1, dayIndex: 0, kind: 'workout' as const, style: 'normal' as const, title: 'Core',
      sessionJson: null, overridden: false, status: 'upcoming' as const };
    await repos.plan.replaceDays(1, [day, { ...day, dayIndex: 1, kind: 'rest', style: null, title: 'Rest' }]);
    await repos.plan.setDayStatus(1, 0, 'done');
    expect((await repos.plan.days(1)).map((x) => x.status)).toEqual(['done', 'upcoming']);
  });

  it('nutrition keeps exactly one active meal plan', async () => {
    await repos.nutrition.saveMealPlan({ id: 'a', profileHash: 'h', days: { mon: [] }, createdAt: 1 });
    await repos.nutrition.saveMealPlan({ id: 'b', profileHash: 'h2', days: {}, createdAt: 2 });
    expect((await repos.nutrition.activeMealPlan())?.id).toBe('b');
    await repos.nutrition.saveProfile({ diet: 'veg', allergies: ['dairy'], allergyOther: null, goal: 'maintain',
      mealsPerDay: 3, targetKcal: 1800, targetProteinG: 60, computedAt: 1, inputsHash: 'x' });
    expect((await repos.nutrition.getProfile())?.allergies).toEqual(['dairy']);
  });

  it('form check attempts keep one key per attempt', async () => {
    const a = { id: 'a1', idempotencyKey: 'k1', exercise: 'squat', state: 'armed' as const, startedAt: 1,
      spentAt: null, wouldHaveBeenCharged: false };
    await repos.formCheck.create(a);
    await expect(repos.formCheck.create({ ...a, id: 'a2' })).rejects.toThrow(); // same key
    await repos.formCheck.setState('a1', 'spent_local', { spentAt: 5, wouldHaveBeenCharged: true });
    expect(await repos.formCheck.get('a1')).toMatchObject({ state: 'spent_local', spentAt: 5, wouldHaveBeenCharged: true });
  });

  it('entitlement cache, learn read and prefs round-trip', async () => {
    await repos.cache.setEntitlements('{"x":1}', 7);
    expect(await repos.cache.getEntitlements()).toEqual({ json: '{"x":1}', fetchedAt: 7 });
    await repos.cache.markRead('m1', 1);
    await repos.cache.markRead('m1', 2);
    expect(await repos.cache.readIds()).toEqual(['m1']);
    await repos.prefs.set('a', '1');
    expect(await repos.prefs.all()).toEqual({ a: '1' });
  });

  it('wipeAll removes personal rows including consent', async () => {
    await repos.profile.save({ name: 'A' });
    await repos.consent.append({ id: 'c', purpose: 'steps', granted: true, noticeVersion: 'v', at: 1, source: 'onboarding' });
    await repos.sessionLog.insert(log());
    await repos.wipeAll();
    expect(await repos.profile.get()).toBeNull();
    expect(await repos.consent.history()).toHaveLength(0);
    expect(await repos.sessionLog.list()).toHaveLength(0);
  });
});

describe('consent_record', () => {
  const rec = (id: string, granted: boolean, at: number) => ({
    id, purpose: 'health_answers' as const, granted, noticeVersion: 'v1', at, source: 'onboarding' as const,
  });

  it('is append-only history with latest-wins', async () => {
    await repos.consent.append(rec('1', true, 1));
    await repos.consent.append(rec('2', false, 2));
    expect(await repos.consent.history('health_answers')).toHaveLength(2);
    expect((await repos.consent.latest()).health_answers?.granted).toBe(false);
  });

  it('refuses to rewrite evidence but allows marking synced', async () => {
    await repos.consent.append(rec('1', true, 1));
    await expect(driver.run('UPDATE consent_record SET granted = 0')).rejects.toThrow(/append-only/);
    await repos.consent.markSynced(['1'], 9);
    expect(await repos.consent.unsynced()).toHaveLength(0);
  });

  it('rejects unknown purposes', async () => {
    await expect(repos.consent.append({ ...rec('x', true, 1), purpose: 'ads' as never })).rejects.toThrow();
  });
});
