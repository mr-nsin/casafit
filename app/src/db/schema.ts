import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Drizzle mirror of migrations.ts. Column names must match (schema.test.ts). */

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name'),
  birthYear: integer('birth_year'),
  confirmed18: integer('confirmed_18').notNull(),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  sex: text('sex', { enum: ['woman', 'man', 'other', 'skip'] }),
  painAreas: text('pain_areas').notNull(),
  healthFlags: text('health_flags').notNull(),
  photoUri: text('photo_uri'),
  stepGoal: integer('step_goal').notNull(),
  locale: text('locale').notNull(),
  theme: text('theme', { enum: ['system', 'light', 'dark'] }).notNull(),
  onboarded: integer('onboarded').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const plan = sqliteTable('plan', {
  id: integer('id').primaryKey(),
  goal: text('goal', { enum: ['stay_fit', 'body_part', 'gentler'] }).notNull(),
  bodyParts: text('body_parts').notNull(),
  styles: text('styles').notNull(),
  mix: text('mix').notNull(),
  daysPerWeek: integer('days_per_week').notNull(),
  experience: text('experience', { enum: ['new', 'on_and_off', 'regular'] }).notNull(),
  variant: text('variant', { enum: ['standard', 'gentler'] }).notNull(),
  weekNumber: integer('week_number').notNull(),
  engineVersion: text('engine_version').notNull(),
  updatedAt: integer('updated_at').notNull(),
  syncedAt: integer('synced_at'),
});

export const planDay = sqliteTable('plan_day', {
  planWeek: integer('plan_week').notNull(),
  dayIndex: integer('day_index').notNull(),
  kind: text('kind', { enum: ['workout', 'walk', 'stretch', 'rest'] }).notNull(),
  style: text('style', { enum: ['normal', 'yoga', 'dance'] }),
  title: text('title').notNull(),
  sessionJson: text('session_json'),
  overridden: integer('overridden').notNull(),
  status: text('status', { enum: ['upcoming', 'today', 'done', 'skipped'] }).notNull(),
});

export const sessionSnapshot = sqliteTable('session_snapshot', {
  id: integer('id').primaryKey(),
  planDayWeek: integer('plan_day_week'),
  planDayIndex: integer('plan_day_index'),
  startedAt: integer('started_at').notNull(),
  stateJson: text('state_json').notNull(),
  snapshotAt: integer('snapshot_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const sessionLog = sqliteTable('session_log', {
  id: text('id').primaryKey(),
  planWeek: integer('plan_week').notNull(),
  planDay: integer('plan_day').notNull(),
  style: text('style', { enum: ['normal', 'yoga', 'dance'] }).notNull(),
  status: text('status', { enum: ['complete', 'unfinished'] }).notNull(),
  durationS: integer('duration_s').notNull(),
  movesDone: integer('moves_done').notNull(),
  movesPlanned: integer('moves_planned').notNull(),
  felt: text('felt', { enum: ['easy', 'about_right', 'hard'] }),
  rungChanges: text('rung_changes').notNull(),
  feelSignals: text('feel_signals').notNull(),
  warmupSkipped: integer('warmup_skipped').notNull(),
  formChecks: integer('form_checks').notNull(),
  quiet: integer('quiet').notNull(),
  completedAt: integer('completed_at').notNull(),
  syncedAt: integer('synced_at'),
});

export const microSessionLog = sqliteTable('micro_session_log', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  activeS: integer('active_s').notNull(),
  at: integer('at').notNull(),
  syncedAt: integer('synced_at'),
});

export const favourite = sqliteTable('favourite', {
  exerciseId: text('exercise_id').primaryKey(),
  at: integer('at').notNull(),
});

export const weeklyCheckin = sqliteTable('weekly_checkin', {
  weekStart: text('week_start').primaryKey(),
  mood: text('mood', { enum: ['tough', 'good', 'great'] }),
  weightKg: real('weight_kg'),
  waistCm: real('waist_cm'),
});

export const foodEntry = sqliteTable('food_entry', {
  id: text('id').primaryKey(),
  loggedOn: text('logged_on').notNull(),
  meal: text('meal', { enum: ['breakfast', 'lunch', 'snack', 'dinner', 'other'] }).notNull(),
  foodId: text('food_id').notNull(),
  unit: text('unit').notNull(),
  portions: real('portions').notNull(),
  snapKcal: integer('snap_kcal'),
  snapProteinG: real('snap_protein_g'),
  snapPackVersion: integer('snap_pack_version'),
  createdAt: integer('created_at').notNull(),
  syncedAt: integer('synced_at'),
});

export const savedMeal = sqliteTable('saved_meal', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  itemsJson: text('items_json').notNull(),
});

export const nutritionProfile = sqliteTable('nutrition_profile', {
  id: integer('id').primaryKey(),
  diet: text('diet', { enum: ['veg', 'egg', 'nonveg', 'jain'] }).notNull(),
  allergies: text('allergies').notNull(),
  allergyOther: text('allergy_other'),
  goal: text('goal', { enum: ['maintain', 'lose_gently', 'gain'] }).notNull(),
  mealsPerDay: integer('meals_per_day').notNull(),
  targetKcal: integer('target_kcal').notNull(),
  targetProteinG: integer('target_protein_g').notNull(),
  computedAt: integer('computed_at').notNull(),
  inputsHash: text('inputs_hash').notNull(),
});

export const mealPlan = sqliteTable('meal_plan', {
  id: text('id').primaryKey(),
  active: integer('active').notNull(),
  profileHash: text('profile_hash').notNull(),
  daysJson: text('days_json').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const stepSummary = sqliteTable('step_summary', {
  onDate: text('on_date').primaryKey(),
  steps: integer('steps').notNull(),
  briskMinutes: integer('brisk_minutes').notNull(),
  source: text('source', { enum: ['pedometer', 'health_connect', 'healthkit'] }).notNull(),
  updatedAt: integer('updated_at').notNull(),
  syncedAt: integer('synced_at'),
});

export const reverseBout = sqliteTable('reverse_bout', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  steps: integer('steps').notNull(),
  stoppedBy: text('stopped_by', { enum: ['user', 'cap', 'app'] }),
});

export const consentRecord = sqliteTable('consent_record', {
  id: text('id').primaryKey(),
  purpose: text('purpose', {
    enum: ['health_answers', 'steps', 'camera', 'analytics', 'terms_privacy'],
  }).notNull(),
  granted: integer('granted').notNull(),
  noticeVersion: text('notice_version').notNull(),
  at: integer('at').notNull(),
  source: text('source', { enum: ['onboarding', 'privacy_screen', 'permission_primer'] }).notNull(),
  syncedAt: integer('synced_at'),
});

export const onboardingDraft = sqliteTable('onboarding_draft', {
  id: integer('id').primaryKey(),
  json: text('json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const formCheckAttempt = sqliteTable('form_check_attempt', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull(),
  exercise: text('exercise').notNull(),
  state: text('state', {
    enum: ['armed', 'counted', 'spent', 'spent_local', 'cancelled', 'refunded'],
  }).notNull(),
  startedAt: integer('started_at').notNull(),
  spentAt: integer('spent_at'),
  wouldHaveBeenCharged: integer('would_have_been_charged').notNull(),
});

export const entitlementCache = sqliteTable('entitlement_cache', {
  id: integer('id').primaryKey(),
  json: text('json').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

export const learnRead = sqliteTable('learn_read', {
  cardId: text('card_id').primaryKey(),
  readAt: integer('read_at').notNull(),
});

export const preference = sqliteTable('preference', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const offlineQueue = sqliteTable('offline_queue', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull(),
  kind: text('kind').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  bodyJson: text('body_json'),
  status: text('status', { enum: ['pending', 'done', 'dead'] }).notNull(),
  attempts: integer('attempts').notNull(),
  nextAttemptAt: integer('next_attempt_at').notNull(),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
  seq: integer('seq').notNull(),
});

export const tables = {
  profile, plan, planDay, sessionSnapshot, sessionLog, microSessionLog, favourite, weeklyCheckin,
  foodEntry, savedMeal, nutritionProfile, mealPlan, stepSummary, reverseBout, consentRecord,
  onboardingDraft, formCheckAttempt, entitlementCache, learnRead, preference, offlineQueue,
};
