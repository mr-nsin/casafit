import type { SqlDriver } from './driver';

/**
 * Ordered, append-only migrations. Never edit a shipped entry; add a new one.
 * schema.ts (Drizzle) must mirror the result; schema.test.ts enforces it.
 * Privacy: nothing here stores GPS, pose frames or landmark streams.
 */
export const MIGRATIONS: { id: number; name: string; sql: string[] }[] = [
  {
    id: 1,
    name: 'init',
    sql: [
      `CREATE TABLE profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT, birth_year INTEGER, confirmed_18 INTEGER NOT NULL DEFAULT 0,
        height_cm REAL, weight_kg REAL,
        sex TEXT CHECK (sex IS NULL OR sex IN ('woman','man','other','skip')),
        pain_areas TEXT NOT NULL DEFAULT '[]', health_flags TEXT NOT NULL DEFAULT '[]',
        photo_uri TEXT, step_goal INTEGER NOT NULL DEFAULT 7000,
        locale TEXT NOT NULL DEFAULT 'en-IN',
        theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
        onboarded INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`,
      `CREATE TABLE plan (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        goal TEXT NOT NULL CHECK (goal IN ('stay_fit','body_part','gentler')),
        body_parts TEXT NOT NULL DEFAULT '[]', styles TEXT NOT NULL DEFAULT '[]',
        mix TEXT NOT NULL DEFAULT '{}',
        days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 3 AND 7),
        experience TEXT NOT NULL CHECK (experience IN ('new','on_and_off','regular')),
        variant TEXT NOT NULL CHECK (variant IN ('standard','gentler')),
        week_number INTEGER NOT NULL DEFAULT 1, engine_version TEXT NOT NULL DEFAULT '1',
        updated_at INTEGER NOT NULL, synced_at INTEGER)`,
      `CREATE TABLE plan_day (
        plan_week INTEGER NOT NULL, day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6),
        kind TEXT NOT NULL CHECK (kind IN ('workout','walk','stretch','rest')),
        style TEXT CHECK (style IS NULL OR style IN ('normal','yoga','dance')),
        title TEXT NOT NULL, session_json TEXT, overridden INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','today','done','skipped')),
        PRIMARY KEY (plan_week, day_index))`,
      `CREATE TABLE session_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1), plan_day_week INTEGER, plan_day_index INTEGER,
        started_at INTEGER NOT NULL, state_json TEXT NOT NULL, snapshot_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL)`,
      `CREATE TABLE session_log (
        id TEXT PRIMARY KEY, plan_week INTEGER NOT NULL, plan_day INTEGER NOT NULL,
        style TEXT NOT NULL CHECK (style IN ('normal','yoga','dance')),
        status TEXT NOT NULL CHECK (status IN ('complete','unfinished')),
        duration_s INTEGER NOT NULL CHECK (duration_s >= 0),
        moves_done INTEGER NOT NULL DEFAULT 0, moves_planned INTEGER NOT NULL DEFAULT 0,
        felt TEXT CHECK (felt IS NULL OR felt IN ('easy','about_right','hard')),
        rung_changes TEXT NOT NULL DEFAULT '[]', feel_signals TEXT NOT NULL DEFAULT '[]',
        warmup_skipped INTEGER NOT NULL DEFAULT 0, form_checks INTEGER NOT NULL DEFAULT 0,
        quiet INTEGER NOT NULL DEFAULT 0, completed_at INTEGER NOT NULL, synced_at INTEGER)`,
      `CREATE INDEX idx_session_log_completed ON session_log (completed_at)`,
      `CREATE TABLE micro_session_log (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, active_s INTEGER NOT NULL CHECK (active_s >= 0),
        at INTEGER NOT NULL, synced_at INTEGER)`,
      `CREATE TABLE favourite (exercise_id TEXT PRIMARY KEY, at INTEGER NOT NULL)`,
      `CREATE TABLE weekly_checkin (
        week_start TEXT PRIMARY KEY,
        mood TEXT CHECK (mood IS NULL OR mood IN ('tough','good','great')),
        weight_kg REAL, waist_cm REAL)`,
      `CREATE TABLE food_entry (
        id TEXT PRIMARY KEY, logged_on TEXT NOT NULL,
        meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','snack','dinner','other')),
        food_id TEXT NOT NULL, unit TEXT NOT NULL, portions REAL NOT NULL CHECK (portions > 0),
        snap_kcal INTEGER, snap_protein_g REAL, snap_pack_version INTEGER,
        created_at INTEGER NOT NULL, synced_at INTEGER)`,
      `CREATE INDEX idx_food_entry_day ON food_entry (logged_on)`,
      `CREATE TABLE saved_meal (id TEXT PRIMARY KEY, name TEXT NOT NULL, items_json TEXT NOT NULL)`,
      `CREATE TABLE nutrition_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        diet TEXT NOT NULL CHECK (diet IN ('veg','egg','nonveg','jain')),
        allergies TEXT NOT NULL DEFAULT '[]', allergy_other TEXT,
        goal TEXT NOT NULL CHECK (goal IN ('maintain','lose_gently','gain')),
        meals_per_day INTEGER NOT NULL CHECK (meals_per_day BETWEEN 3 AND 5),
        target_kcal INTEGER NOT NULL, target_protein_g INTEGER NOT NULL,
        computed_at INTEGER NOT NULL, inputs_hash TEXT NOT NULL)`,
      `CREATE TABLE meal_plan (
        id TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 0, profile_hash TEXT NOT NULL,
        days_json TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE step_summary (
        on_date TEXT PRIMARY KEY, steps INTEGER NOT NULL CHECK (steps >= 0),
        brisk_minutes INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL CHECK (source IN ('pedometer','health_connect','healthkit')),
        updated_at INTEGER NOT NULL, synced_at INTEGER)`,
      `CREATE TABLE reverse_bout (
        id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER,
        steps INTEGER NOT NULL DEFAULT 0,
        stopped_by TEXT CHECK (stopped_by IS NULL OR stopped_by IN ('user','cap','app')))`,
      `CREATE TABLE consent_record (
        id TEXT PRIMARY KEY,
        purpose TEXT NOT NULL CHECK (purpose IN ('health_answers','steps','camera','analytics','terms_privacy')),
        granted INTEGER NOT NULL, notice_version TEXT NOT NULL, at INTEGER NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('onboarding','privacy_screen','permission_primer')),
        synced_at INTEGER)`,
      // Append-only evidence: the consent facts cannot be rewritten (synced_at may be set).
      `CREATE TRIGGER consent_record_no_update BEFORE UPDATE OF purpose, granted, notice_version, at, source ON consent_record
        BEGIN SELECT RAISE(ABORT, 'consent_record is append-only'); END`,
      `CREATE TABLE onboarding_draft (
        id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
      `CREATE TABLE form_check_attempt (
        id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, exercise TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('armed','counted','spent','spent_local','cancelled','refunded')),
        started_at INTEGER NOT NULL, spent_at INTEGER, would_have_been_charged INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE entitlement_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, fetched_at INTEGER NOT NULL)`,
      `CREATE TABLE learn_read (card_id TEXT PRIMARY KEY, read_at INTEGER NOT NULL)`,
      `CREATE TABLE preference (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `CREATE TABLE offline_queue (
        id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
        method TEXT NOT NULL, path TEXT NOT NULL, body_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','dead')),
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
        last_error TEXT, created_at INTEGER NOT NULL, seq INTEGER NOT NULL)`,
      `CREATE INDEX idx_offline_queue_due ON offline_queue (status, next_attempt_at, seq)`,
    ],
  },
];

export async function runMigrations(d: SqlDriver): Promise<number> {
  await d.run(
    'CREATE TABLE IF NOT EXISTS schema_migration (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const done = new Set(
    (await d.all<{ id: number }>('SELECT id FROM schema_migration')).map((r) => r.id),
  );
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await d.transaction(async () => {
      for (const stmt of m.sql) await d.run(stmt);
      await d.run('INSERT INTO schema_migration (id, name, applied_at) VALUES (?, ?, ?)', [
        m.id,
        m.name,
        Date.now(),
      ]);
    });
    applied++;
  }
  return applied;
}
