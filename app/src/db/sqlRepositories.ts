import { getOne, type SqlDriver, type SqlValue } from './driver';
import type {
  ConsentPurpose,
  ConsentRecord,
  FoodEntry,
  FormCheckAttempt,
  MealPlanRow,
  NutritionProfile,
  OnboardingDraft,
  PlanDayRow,
  PlanRow,
  Profile,
  Repositories,
  ReverseBout,
  SavedMeal,
  SessionLog,
  SessionSnapshot,
  StepSummary,
  WeeklyCheckin,
} from './repositories';

type Row = Record<string, SqlValue>;
const b = (v: SqlValue | undefined): boolean => v === 1;
const n = (v: boolean): number => (v ? 1 : 0);
const j = <T>(v: SqlValue | undefined, fallback: T): T => {
  if (typeof v !== 'string') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const marks = (ids: unknown[]) => ids.map(() => '?').join(',');

export function createSqlRepositories(d: SqlDriver): Repositories {
  const profile: Repositories['profile'] = {
    async get() {
      const r = await getOne<Row>(d, 'SELECT * FROM profile WHERE id = 1');
      if (!r) return null;
      return {
        name: r.name as string | null,
        birthYear: r.birth_year as number | null,
        confirmed18: b(r.confirmed_18),
        heightCm: r.height_cm as number | null,
        weightKg: r.weight_kg as number | null,
        sex: r.sex as Profile['sex'],
        painAreas: j(r.pain_areas, []),
        healthFlags: j(r.health_flags, []),
        photoUri: r.photo_uri as string | null,
        stepGoal: r.step_goal as number,
        locale: r.locale as string,
        theme: r.theme as Profile['theme'],
        onboarded: b(r.onboarded),
        updatedAt: r.updated_at as number,
      };
    },
    async save(patch) {
      const cur: Profile = (await profile.get()) ?? {
        name: null, birthYear: null, confirmed18: false, heightCm: null, weightKg: null,
        sex: null, painAreas: [], healthFlags: [], photoUri: null, stepGoal: 7000,
        locale: 'en-IN', theme: 'system', onboarded: false, updatedAt: 0,
      };
      const p: Profile = { ...cur, ...patch, updatedAt: Date.now() };
      await d.run(
        `INSERT OR REPLACE INTO profile (id, name, birth_year, confirmed_18, height_cm, weight_kg, sex,
          pain_areas, health_flags, photo_uri, step_goal, locale, theme, onboarded, updated_at)
         VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.name, p.birthYear, n(p.confirmed18), p.heightCm, p.weightKg, p.sex,
          JSON.stringify(p.painAreas), JSON.stringify(p.healthFlags), p.photoUri, p.stepGoal,
          p.locale, p.theme, n(p.onboarded), p.updatedAt],
      );
      return p;
    },
    async clear() {
      await d.run('DELETE FROM profile');
    },
  };

  const plan: Repositories['plan'] = {
    async get() {
      const r = await getOne<Row>(d, 'SELECT * FROM plan WHERE id = 1');
      if (!r) return null;
      return {
        goal: r.goal as PlanRow['goal'],
        bodyParts: j(r.body_parts, []),
        styles: j(r.styles, []),
        mix: j(r.mix, {}),
        daysPerWeek: r.days_per_week as number,
        experience: r.experience as PlanRow['experience'],
        variant: r.variant as PlanRow['variant'],
        weekNumber: r.week_number as number,
        engineVersion: r.engine_version as string,
        updatedAt: r.updated_at as number,
        syncedAt: r.synced_at as number | null,
      };
    },
    async save(p) {
      await d.run(
        `INSERT OR REPLACE INTO plan (id, goal, body_parts, styles, mix, days_per_week, experience,
          variant, week_number, engine_version, updated_at, synced_at)
         VALUES (1,?,?,?,?,?,?,?,?,?,?,NULL)`,
        [p.goal, JSON.stringify(p.bodyParts), JSON.stringify(p.styles), JSON.stringify(p.mix),
          p.daysPerWeek, p.experience, p.variant, p.weekNumber, p.engineVersion, Date.now()],
      );
    },
    async markSynced(at) {
      await d.run('UPDATE plan SET synced_at = ? WHERE id = 1', [at]);
    },
    async days(week) {
      const rows = await d.all<Row>(
        'SELECT * FROM plan_day WHERE plan_week = ? ORDER BY day_index',
        [week],
      );
      return rows.map((r) => ({
        planWeek: r.plan_week as number,
        dayIndex: r.day_index as number,
        kind: r.kind as PlanDayRow['kind'],
        style: r.style as PlanDayRow['style'],
        title: r.title as string,
        sessionJson: r.session_json as string | null,
        overridden: b(r.overridden),
        status: r.status as PlanDayRow['status'],
      }));
    },
    async replaceDays(week, days) {
      await d.transaction(async () => {
        await d.run('DELETE FROM plan_day WHERE plan_week = ?', [week]);
        for (const x of days) {
          await d.run(
            `INSERT INTO plan_day (plan_week, day_index, kind, style, title, session_json, overridden, status)
             VALUES (?,?,?,?,?,?,?,?)`,
            [week, x.dayIndex, x.kind, x.style, x.title, x.sessionJson, n(x.overridden), x.status],
          );
        }
      });
    },
    async setDayStatus(week, dayIndex, status) {
      await d.run('UPDATE plan_day SET status = ? WHERE plan_week = ? AND day_index = ?', [
        status, week, dayIndex,
      ]);
    },
    async clear() {
      await d.run('DELETE FROM plan_day');
      await d.run('DELETE FROM plan');
    },
  };

  const mapLog = (r: Row): SessionLog => ({
    id: r.id as string,
    planWeek: r.plan_week as number,
    planDay: r.plan_day as number,
    style: r.style as SessionLog['style'],
    status: r.status as SessionLog['status'],
    durationS: r.duration_s as number,
    movesDone: r.moves_done as number,
    movesPlanned: r.moves_planned as number,
    felt: r.felt as SessionLog['felt'],
    rungChanges: j(r.rung_changes, []),
    feelSignals: j(r.feel_signals, []),
    warmupSkipped: b(r.warmup_skipped),
    formChecks: r.form_checks as number,
    quiet: b(r.quiet),
    completedAt: r.completed_at as number,
    syncedAt: r.synced_at as number | null,
  });

  const sessionLog: Repositories['sessionLog'] = {
    async insert(l) {
      if (await getOne(d, 'SELECT 1 FROM session_log WHERE id = ?', [l.id])) return false;
      await d.run(
        `INSERT INTO session_log (id, plan_week, plan_day, style, status, duration_s, moves_done,
          moves_planned, felt, rung_changes, feel_signals, warmup_skipped, form_checks, quiet, completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [l.id, l.planWeek, l.planDay, l.style, l.status, l.durationS, l.movesDone, l.movesPlanned,
          l.felt, JSON.stringify(l.rungChanges), JSON.stringify(l.feelSignals), n(l.warmupSkipped),
          l.formChecks, n(l.quiet), l.completedAt],
      );
      return true;
    },
    async list(opts) {
      const where: string[] = [];
      const args: SqlValue[] = [];
      if (opts?.sinceMs !== undefined) { where.push('completed_at >= ?'); args.push(opts.sinceMs); }
      if (opts?.status) { where.push('status = ?'); args.push(opts.status); }
      const rows = await d.all<Row>(
        `SELECT * FROM session_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY completed_at`,
        args,
      );
      return rows.map(mapLog);
    },
    async unsynced() {
      return (await d.all<Row>('SELECT * FROM session_log WHERE synced_at IS NULL ORDER BY completed_at')).map(mapLog);
    },
    async markSynced(ids, at) {
      if (!ids.length) return;
      await d.run(`UPDATE session_log SET synced_at = ? WHERE id IN (${marks(ids)})`, [at, ...ids]);
    },
  };

  const snapshot: Repositories['snapshot'] = {
    async save(s) {
      await d.run(
        `INSERT OR REPLACE INTO session_snapshot (id, plan_day_week, plan_day_index, started_at, state_json, snapshot_at, expires_at)
         VALUES (1,?,?,?,?,?,?)`,
        [s.planDayWeek, s.planDayIndex, s.startedAt, s.stateJson, s.snapshotAt, s.expiresAt],
      );
    },
    async load(now) {
      const r = await getOne<Row>(d, 'SELECT * FROM session_snapshot WHERE id = 1');
      if (!r) return null;
      if ((r.expires_at as number) <= now) {
        await d.run('DELETE FROM session_snapshot');
        return null;
      }
      const s: SessionSnapshot = {
        planDayWeek: r.plan_day_week as number | null,
        planDayIndex: r.plan_day_index as number | null,
        startedAt: r.started_at as number,
        stateJson: r.state_json as string,
        snapshotAt: r.snapshot_at as number,
        expiresAt: r.expires_at as number,
      };
      return s;
    },
    async clear() {
      await d.run('DELETE FROM session_snapshot');
    },
  };

  const micro: Repositories['micro'] = {
    async insert(m) {
      if (await getOne(d, 'SELECT 1 FROM micro_session_log WHERE id = ?', [m.id])) return false;
      await d.run('INSERT INTO micro_session_log (id, plan_id, active_s, at) VALUES (?,?,?,?)', [
        m.id, m.planId, m.activeS, m.at,
      ]);
      return true;
    },
    async totalActiveS(sinceMs) {
      const r = await getOne<{ t: number | null }>(
        d, 'SELECT SUM(active_s) AS t FROM micro_session_log WHERE at >= ?', [sinceMs],
      );
      return r?.t ?? 0;
    },
  };

  const favourites: Repositories['favourites'] = {
    async toggle(id, at) {
      if (await getOne(d, 'SELECT 1 FROM favourite WHERE exercise_id = ?', [id])) {
        await d.run('DELETE FROM favourite WHERE exercise_id = ?', [id]);
        return false;
      }
      await d.run('INSERT INTO favourite (exercise_id, at) VALUES (?,?)', [id, at]);
      return true;
    },
    async all() {
      return (await d.all<{ exercise_id: string }>('SELECT exercise_id FROM favourite ORDER BY at')).map(
        (r) => r.exercise_id,
      );
    },
  };

  const checkin: Repositories['checkin'] = {
    async save(c) {
      await d.run(
        'INSERT OR REPLACE INTO weekly_checkin (week_start, mood, weight_kg, waist_cm) VALUES (?,?,?,?)',
        [c.weekStart, c.mood, c.weightKg, c.waistCm],
      );
    },
    async get(weekStart) {
      const r = await getOne<Row>(d, 'SELECT * FROM weekly_checkin WHERE week_start = ?', [weekStart]);
      if (!r) return null;
      const c: WeeklyCheckin = {
        weekStart: r.week_start as string,
        mood: r.mood as WeeklyCheckin['mood'],
        weightKg: r.weight_kg as number | null,
        waistCm: r.waist_cm as number | null,
      };
      return c;
    },
  };

  const mapFood = (r: Row): FoodEntry => ({
    id: r.id as string,
    loggedOn: r.logged_on as string,
    meal: r.meal as FoodEntry['meal'],
    foodId: r.food_id as string,
    unit: r.unit as string,
    portions: r.portions as number,
    snapshot:
      r.snap_kcal === null || r.snap_kcal === undefined
        ? null
        : {
            kcal: r.snap_kcal as number,
            proteinG: r.snap_protein_g as number,
            packVersion: r.snap_pack_version as number,
          },
    createdAt: r.created_at as number,
    syncedAt: r.synced_at as number | null,
  });

  const food: Repositories['food'] = {
    async add(e) {
      if (await getOne(d, 'SELECT 1 FROM food_entry WHERE id = ?', [e.id])) return false;
      await d.run(
        `INSERT INTO food_entry (id, logged_on, meal, food_id, unit, portions, snap_kcal, snap_protein_g, snap_pack_version, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [e.id, e.loggedOn, e.meal, e.foodId, e.unit, e.portions, e.snapshot?.kcal ?? null,
          e.snapshot?.proteinG ?? null, e.snapshot?.packVersion ?? null, e.createdAt],
      );
      return true;
    },
    async update(id, patch) {
      if (patch.portions !== undefined)
        await d.run('UPDATE food_entry SET portions = ?, synced_at = NULL WHERE id = ?', [patch.portions, id]);
      if (patch.meal !== undefined)
        await d.run('UPDATE food_entry SET meal = ?, synced_at = NULL WHERE id = ?', [patch.meal, id]);
    },
    async remove(id) {
      await d.run('DELETE FROM food_entry WHERE id = ?', [id]);
    },
    async forDay(day) {
      return (await d.all<Row>('SELECT * FROM food_entry WHERE logged_on = ? ORDER BY created_at', [day])).map(mapFood);
    },
    async recentFoodIds(limit) {
      return (
        await d.all<{ food_id: string }>(
          'SELECT food_id FROM food_entry GROUP BY food_id ORDER BY MAX(created_at) DESC LIMIT ?',
          [limit],
        )
      ).map((r) => r.food_id);
    },
    async unsynced() {
      return (await d.all<Row>('SELECT * FROM food_entry WHERE synced_at IS NULL ORDER BY created_at')).map(mapFood);
    },
    async markSynced(ids, at) {
      if (!ids.length) return;
      await d.run(`UPDATE food_entry SET synced_at = ? WHERE id IN (${marks(ids)})`, [at, ...ids]);
    },
  };

  const nutrition: Repositories['nutrition'] = {
    async getProfile() {
      const r = await getOne<Row>(d, 'SELECT * FROM nutrition_profile WHERE id = 1');
      if (!r) return null;
      const p: NutritionProfile = {
        diet: r.diet as NutritionProfile['diet'],
        allergies: j(r.allergies, []),
        allergyOther: r.allergy_other as string | null,
        goal: r.goal as NutritionProfile['goal'],
        mealsPerDay: r.meals_per_day as NutritionProfile['mealsPerDay'],
        targetKcal: r.target_kcal as number,
        targetProteinG: r.target_protein_g as number,
        computedAt: r.computed_at as number,
        inputsHash: r.inputs_hash as string,
      };
      return p;
    },
    async saveProfile(p) {
      await d.run(
        `INSERT OR REPLACE INTO nutrition_profile (id, diet, allergies, allergy_other, goal, meals_per_day,
          target_kcal, target_protein_g, computed_at, inputs_hash) VALUES (1,?,?,?,?,?,?,?,?,?)`,
        [p.diet, JSON.stringify(p.allergies), p.allergyOther, p.goal, p.mealsPerDay, p.targetKcal,
          p.targetProteinG, p.computedAt, p.inputsHash],
      );
    },
    async activeMealPlan() {
      const r = await getOne<Row>(d, 'SELECT * FROM meal_plan WHERE active = 1');
      if (!r) return null;
      const m: MealPlanRow = {
        id: r.id as string,
        active: true,
        profileHash: r.profile_hash as string,
        days: j(r.days_json, {}),
        createdAt: r.created_at as number,
      };
      return m;
    },
    async saveMealPlan(p) {
      await d.transaction(async () => {
        await d.run('UPDATE meal_plan SET active = 0');
        await d.run(
          'INSERT OR REPLACE INTO meal_plan (id, active, profile_hash, days_json, created_at) VALUES (?,1,?,?,?)',
          [p.id, p.profileHash, JSON.stringify(p.days), p.createdAt],
        );
      });
    },
    async savedMeals() {
      return (await d.all<Row>('SELECT * FROM saved_meal ORDER BY name')).map(
        (r): SavedMeal => ({ id: r.id as string, name: r.name as string, items: j(r.items_json, []) }),
      );
    },
    async saveMeal(m) {
      await d.run('INSERT OR REPLACE INTO saved_meal (id, name, items_json) VALUES (?,?,?)', [
        m.id, m.name, JSON.stringify(m.items),
      ]);
    },
    async removeSavedMeal(id) {
      await d.run('DELETE FROM saved_meal WHERE id = ?', [id]);
    },
  };

  const steps: Repositories['steps'] = {
    async upsert(s) {
      await d.run(
        `INSERT OR REPLACE INTO step_summary (on_date, steps, brisk_minutes, source, updated_at, synced_at)
         VALUES (?,?,?,?,?,NULL)`,
        [s.onDate, s.steps, s.briskMinutes, s.source, s.updatedAt],
      );
    },
    async range(from, to) {
      return (
        await d.all<Row>('SELECT * FROM step_summary WHERE on_date BETWEEN ? AND ? ORDER BY on_date', [from, to])
      ).map(mapStep);
    },
    async unsynced() {
      return (await d.all<Row>('SELECT * FROM step_summary WHERE synced_at IS NULL ORDER BY on_date')).map(mapStep);
    },
    async markSynced(dates, at) {
      if (!dates.length) return;
      await d.run(`UPDATE step_summary SET synced_at = ? WHERE on_date IN (${marks(dates)})`, [at, ...dates]);
    },
    async purge() {
      await d.run('DELETE FROM step_summary');
      await d.run('DELETE FROM reverse_bout');
    },
    async startBout(x) {
      await d.run('INSERT INTO reverse_bout (id, started_at) VALUES (?,?)', [x.id, x.startedAt]);
    },
    async endBout(id, endedAt, stepCount, stoppedBy) {
      await d.run('UPDATE reverse_bout SET ended_at = ?, steps = ?, stopped_by = ? WHERE id = ?', [
        endedAt, stepCount, stoppedBy, id,
      ]);
    },
    async boutsSince(since) {
      return (await d.all<Row>('SELECT * FROM reverse_bout WHERE started_at >= ? ORDER BY started_at', [since])).map(
        (r): ReverseBout => ({
          id: r.id as string,
          startedAt: r.started_at as number,
          endedAt: r.ended_at as number | null,
          steps: r.steps as number,
          stoppedBy: r.stopped_by as ReverseBout['stoppedBy'],
        }),
      );
    },
  };
  function mapStep(r: Row): StepSummary {
    return {
      onDate: r.on_date as string,
      steps: r.steps as number,
      briskMinutes: r.brisk_minutes as number,
      source: r.source as StepSummary['source'],
      updatedAt: r.updated_at as number,
      syncedAt: r.synced_at as number | null,
    };
  }

  const mapConsent = (r: Row): ConsentRecord => ({
    id: r.id as string,
    purpose: r.purpose as ConsentPurpose,
    granted: b(r.granted),
    noticeVersion: r.notice_version as string,
    at: r.at as number,
    source: r.source as ConsentRecord['source'],
  });
  const consent: Repositories['consent'] = {
    async append(r) {
      await d.run(
        'INSERT INTO consent_record (id, purpose, granted, notice_version, at, source) VALUES (?,?,?,?,?,?)',
        [r.id, r.purpose, n(r.granted), r.noticeVersion, r.at, r.source],
      );
    },
    async history(purpose) {
      const rows = purpose
        ? await d.all<Row>('SELECT * FROM consent_record WHERE purpose = ? ORDER BY at, rowid', [purpose])
        : await d.all<Row>('SELECT * FROM consent_record ORDER BY at, rowid');
      return rows.map(mapConsent);
    },
    async latest() {
      const out: Partial<Record<ConsentPurpose, ConsentRecord>> = {};
      for (const r of await consent.history()) out[r.purpose] = r; // ascending, so last wins
      return out;
    },
    async unsynced() {
      return (await d.all<Row>('SELECT * FROM consent_record WHERE synced_at IS NULL ORDER BY at, rowid')).map(mapConsent);
    },
    async markSynced(ids, at) {
      if (!ids.length) return;
      await d.run(`UPDATE consent_record SET synced_at = ? WHERE id IN (${marks(ids)})`, [at, ...ids]);
    },
  };

  const onboardingDraft: Repositories['onboardingDraft'] = {
    async load() {
      const r = await getOne<Row>(d, 'SELECT json FROM onboarding_draft WHERE id = 1');
      return r ? j<OnboardingDraft | null>(r.json, null) : null;
    },
    async save(x) {
      await d.run('INSERT OR REPLACE INTO onboarding_draft (id, json, updated_at) VALUES (1,?,?)', [
        JSON.stringify(x), Date.now(),
      ]);
    },
    async clear() {
      await d.run('DELETE FROM onboarding_draft');
    },
  };

  const formCheck: Repositories['formCheck'] = {
    async create(a) {
      await d.run(
        `INSERT INTO form_check_attempt (id, idempotency_key, exercise, state, started_at, spent_at, would_have_been_charged)
         VALUES (?,?,?,?,?,?,?)`,
        [a.id, a.idempotencyKey, a.exercise, a.state, a.startedAt, a.spentAt, n(a.wouldHaveBeenCharged)],
      );
    },
    async get(id) {
      const r = await getOne<Row>(d, 'SELECT * FROM form_check_attempt WHERE id = ?', [id]);
      if (!r) return null;
      const a: FormCheckAttempt = {
        id: r.id as string,
        idempotencyKey: r.idempotency_key as string,
        exercise: r.exercise as string,
        state: r.state as FormCheckAttempt['state'],
        startedAt: r.started_at as number,
        spentAt: r.spent_at as number | null,
        wouldHaveBeenCharged: b(r.would_have_been_charged),
      };
      return a;
    },
    async setState(id, state, extra) {
      await d.run(
        `UPDATE form_check_attempt SET state = ?, spent_at = COALESCE(?, spent_at),
         would_have_been_charged = COALESCE(?, would_have_been_charged) WHERE id = ?`,
        [state, extra?.spentAt ?? null,
          extra?.wouldHaveBeenCharged === undefined ? null : n(extra.wouldHaveBeenCharged), id],
      );
    },
  };

  const cache: Repositories['cache'] = {
    async getEntitlements() {
      const r = await getOne<Row>(d, 'SELECT json, fetched_at FROM entitlement_cache WHERE id = 1');
      return r ? { json: r.json as string, fetchedAt: r.fetched_at as number } : null;
    },
    async setEntitlements(json, fetchedAt) {
      await d.run('INSERT OR REPLACE INTO entitlement_cache (id, json, fetched_at) VALUES (1,?,?)', [json, fetchedAt]);
    },
    async markRead(cardId, at) {
      await d.run('INSERT OR IGNORE INTO learn_read (card_id, read_at) VALUES (?,?)', [cardId, at]);
    },
    async readIds() {
      return (await d.all<{ card_id: string }>('SELECT card_id FROM learn_read')).map((r) => r.card_id);
    },
  };

  const prefs: Repositories['prefs'] = {
    async get(key) {
      const r = await getOne<{ value: string }>(d, 'SELECT value FROM preference WHERE key = ?', [key]);
      return r?.value ?? null;
    },
    async set(key, value) {
      await d.run('INSERT OR REPLACE INTO preference (key, value) VALUES (?,?)', [key, value]);
    },
    async all() {
      const out: Record<string, string> = {};
      for (const r of await d.all<{ key: string; value: string }>('SELECT key, value FROM preference'))
        out[r.key] = r.value;
      return out;
    },
  };

  const PERSONAL_TABLES = [
    'profile', 'plan', 'plan_day', 'session_snapshot', 'session_log', 'micro_session_log',
    'favourite', 'weekly_checkin', 'food_entry', 'saved_meal', 'nutrition_profile', 'meal_plan',
    'step_summary', 'reverse_bout', 'consent_record', 'onboarding_draft', 'form_check_attempt',
    'entitlement_cache', 'learn_read', 'preference', 'offline_queue',
  ];

  return {
    profile, plan, sessionLog, snapshot, micro, favourites, checkin, food, nutrition, steps,
    consent, onboardingDraft, formCheck, cache, prefs,
    async wipeAll() {
      await d.transaction(async () => {
        for (const t of PERSONAL_TABLES) await d.run(`DELETE FROM ${t}`);
      });
    },
  };
}
