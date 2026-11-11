// Every screen and the states worth pressing in. One entry per variant; a screen with several states has
// several entries. Add a scenario whenever a screen gains a state (scenarios.coverage.test.ts fails for a screen with none).

import type { ComponentType } from 'react';

import { formCheckRoutes } from '../features/formcheck';
import { learnRoutes } from '../features/learn';
import { nutritionRoutes, nutritionTab } from '../features/nutrition';
import { onboardingRoutes } from '../features/onboarding';
import { progressRoutes } from '../features/progress';
import { sessionRoutes } from '../features/session';
import { settingsRoutes } from '../features/settings';
import { stepsRoutes } from '../features/steps';
import { HomeScreen } from '../screens/Home';
import { useBout } from '../features/steps/reverseStore';
import { useFormCheck } from '../features/formcheck/controller';
import { useEntitlements } from '../features/formcheck/entitlements';
import { useVerifyOutcome } from '../features/onboarding/flowState';
import { useSessionStore } from '../features/session/store';
import { configureSessionDeps } from '../features/session/deps';
import { useEditDraft } from '../features/session/browse/editing';
import { startSession } from '../features/session/start';
import { parseSession } from '../features/session/browse/model';
import { COMEBACK_KEY } from '../features/session/browse/comeback';
import { buildMealPlan, profileHash } from '../features/nutrition/logic';
import { loadContent } from '../content';
import { fakeSession } from '../services/auth';
import { squatSequence } from '../services/pose/synthetic';
import { DAY_MS } from '../services/purchases';
import { useAuth } from '../state/auth';
import { useOnboarding } from '../state/onboardingDraft';
import { usePreferences } from '../state/preferences';
import { makePlan } from '../features/session/testkit';
import type { Scenario } from './run';
import { NOW, type World } from './world';

type AnyRoutes = Record<string, { component: ComponentType<any> }>;

/** Every stack route's component, keyed by route name. Same merge as RootNavigator, without the navigator. */
const { Progress: progressTabEntry, ...progressStack } = progressRoutes;
export const screens: Record<string, ComponentType<any>> = Object.fromEntries(
  Object.entries({
    ...(onboardingRoutes as AnyRoutes),
    ...(sessionRoutes as AnyRoutes),
    ...(formCheckRoutes as AnyRoutes),
    ...(nutritionRoutes as AnyRoutes),
    ...(stepsRoutes as AnyRoutes),
    ...(learnRoutes as AnyRoutes),
    ...(progressStack as AnyRoutes),
    ...(settingsRoutes as AnyRoutes),
  }).map(([k, v]) => [k, v.component]),
);
export const tabScreens: Record<string, ComponentType<any>> = {
  Workout: HomeScreen,
  Nutrition: nutritionTab,
  Progress: progressTabEntry.component,
};

const content = loadContent();

function sc(screen: string, variant: string, extra: Partial<Scenario> = {}): Scenario {
  const Comp = screens[screen] ?? tabScreens[screen];
  if (!Comp) throw new Error(`No component for ${screen}`);
  return { id: `${screen} / ${variant}`, screen, variant, element: (p) => <Comp {...p} />, ...extra };
}

// ---------- seeding helpers ----------

const draftFilled = { birthYear: 1995, confirmed18: true, goal: 'stay_fit' as const, styles: ['normal' as const], experience: 'on_and_off' as const, daysPerWeek: 4, sex: 'woman' as const, heightCm: 162, weightKg: 60 };

async function fillDraft(patch: Record<string, unknown> = {}) {
  await useOnboarding.getState().update({ ...draftFilled, ...patch } as never);
}

const profile = (over: Record<string, unknown> = {}) => ({
  diet: 'veg' as const, allergies: [], allergyOther: null, goal: 'maintain' as const, mealsPerDay: 4, targetKcal: 1800, targetProteinG: 70, computedAt: NOW, inputsHash: 'x', ...over,
});

async function seedNutrition(w: World, over: Record<string, unknown> = {}, withPlan = true) {
  const p = profile(over) as never;
  await w.rawRepos.nutrition.saveProfile(p);
  if (withPlan) await w.rawRepos.nutrition.saveMealPlan({ id: 'p', profileHash: profileHash(p), days: buildMealPlan(content, p), createdAt: NOW });
  await w.rawRepos.profile.save({ birthYear: 1990, sex: 'woman', heightCm: 162, weightKg: 60 } as never);
}

async function todaysPlan(w: World) {
  const rows = await w.rawRepos.plan.days(1);
  const row = rows.find((r) => r.sessionJson && r.kind === 'workout' && r.dayIndex === 0) ?? rows.find((r) => r.sessionJson);
  const plan = parseSession(row ?? null);
  if (!plan) throw new Error('seed has no session');
  return { plan, planDay: row!.dayIndex };
}

async function draftFor(w: World) {
  const { plan, planDay } = await todaysPlan(w);
  useEditDraft.getState().init({ key: `1-${planDay}`, week: 1, dayIndex: planDay, session: plan as never });
}

/** Starts the canonical 15-minute session (4 warm-up, 5 work, 4 cool-down) and moves the clock. */
function begin(w: World, opts: { advanceMs?: number; style?: 'normal' | 'yoga' | 'dance' } = {}) {
  w.harness.store.getState().start(makePlan({ style: opts.style ?? 'normal' }), { planWeek: 1, planDay: 0 });
  if (opts.advanceMs) w.harness.advance(opts.advanceMs);
}
const WORK_1 = 120_000 + 12_000 + 5_000; // first work set
const REST_1 = 120_000 + 12_000 + 41_000; // first rest
const CHECKABLE = 401_000; // third move, form-checkable
const END = 900_000 + 5_000;

async function loginHistory(w: World, daysAgo: number, id = 'l1') {
  await w.rawRepos.sessionLog.insert({
    id, planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: 900, movesDone: 5, movesPlanned: 5, felt: 'about_right',
    rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: Date.now() - daysAgo * DAY_MS,
  });
}

const resultFor = (over: Record<string, unknown> = {}) => ({
  attemptId: 'a', exercise: 'squat' as const, repsAnalysed: 6, repsClean: 4,
  perRep: [1, 2, 3, 4, 5, 6].map((i) => ({ index: i, ok: i !== 3 && i !== 5, ...(i === 3 || i === 5 ? { issue: 'knees' as const } : {}) })),
  findings: [{ area: 'knees' as const, status: 'warn' as const, text: 'Knees drift in' }, { area: 'depth' as const, status: 'ok' as const, text: 'Good depth' }],
  rating: 'good' as const, tip: 'Push your knees out over your toes.', spend: 'spent' as const, creditsLeft: 1, ...over,
});

// ---------- scenarios ----------

export const scenarios: Scenario[] = [
  // ----- onboarding -----
  sc('Splash', 'signed out', { world: { signedIn: false, plan: false }, noControls: true }),
  sc('Welcome', 'first visit', { world: { signedIn: false, plan: false } }),
  sc('Welcome', 'session ended note', { world: { signedIn: false, plan: false }, setup: () => useAuth.setState({ sessionEnded: true }) }),
  sc('Age', 'empty', { world: { signedIn: false, plan: false } }),
  sc('Age', 'adult confirmed', { world: { signedIn: false, plan: false }, setup: () => fillDraft() }),
  sc('Age', 'under 18', { world: { signedIn: false, plan: false }, setup: () => fillDraft({ birthYear: 2015 }) }),
  sc('Verify', 'email step', { world: { signedIn: false, plan: false }, needsDevice: ['Google, Apple and Facebook sign-in open a system browser or native sheet', 'Email code arrives from Supabase'] }),
  sc('Verify', 'email prefilled', { world: { signedIn: false, plan: false }, params: { email: 'priya@gmail.com' } }),
  sc('Verify', 'send fails', { world: { signedIn: false, plan: false }, params: { email: 'priya@gmail.com' }, setup: (w) => void (w.auth.sendResult = { ok: false, reason: 'network' } as never) }),
  sc('Offline', 'offline', { world: { signedIn: false, plan: false, offline: true } }),
  sc('WelcomeBack', 'returning user', { world: { plan: true }, setup: () => useVerifyOutcome.getState().set({ masked: 'p***@gmail.com', provider: 'google' } as never) }),
  sc('Goals', 'empty', { world: { plan: false }, setup: () => fillDraft({ goal: null, styles: [] }) }),
  sc('Goals', 'body part goal', { world: { plan: false }, setup: () => fillDraft({ goal: 'body_part', bodyParts: ['core'] }) }),
  sc('About', 'filled', { world: { plan: false }, setup: () => fillDraft() }),
  sc('About', 'empty', { world: { plan: false } }),
  sc('Mix', 'three styles', { world: { plan: false }, setup: () => fillDraft({ styles: ['normal', 'yoga', 'dance'] }) }),
  sc('Health', 'none ticked', { world: { plan: false }, setup: () => fillDraft() }),
  sc('Health', 'flag ticked', { world: { plan: false }, setup: () => fillDraft({ healthFlags: ['heart_bp'], healthConsent: true }) }),
  sc('Building', 'building', { world: { plan: false }, setup: () => fillDraft(), noControls: true, settleMs: 5 }),
  sc('WeekOne', 'after build', { world: { plan: true } }),

  // ----- Home (Workout tab) and plan -----
  sc('Workout', 'training day', { needsDevice: ['Tab bar and scroll position are not rendered here'] }),
  sc('Workout', 'training day, Pro', { world: { pro: {} } }),
  sc('Workout', 'training day, steps and food logged', { world: { history: true } }),
  sc('Workout', 'calories hidden', { world: { hideCalories: true } }),
  sc('Workout', 'rest day, walk', { world: { dayOffset: 2 } }),
  sc('Workout', 'rest day, stretch', { world: { dayOffset: 4 } }),
  sc('Workout', 'resume card', {
    setup: async (w) => {
      w.harness.store.getState().start(makePlan({ title: 'Push 15' }), { planWeek: 1, planDay: 0 });
      w.harness.advance(200_000);
      w.harness.store.getState().pause('user');
      await w.harness.store.getState().requestEnd();
      await w.harness.store.getState().saveForLater();
      configureSessionDeps({ clock: w.harness.clock });
    },
  }),
  sc('Workout', 'finished but not saved', {
    setup: async (w) => {
      w.harness.store.getState().start(makePlan({ title: 'Push 15' }), { planWeek: 1, planDay: 0 });
      w.harness.advance(900_000);
      w.harness.store.getState().reset();
      configureSessionDeps({ clock: w.harness.clock });
    },
  }),
  sc('Workout', 'comeback after 9 days', { setup: (w) => loginHistory(w, 9) }),
  sc('Workout', 'no plan', { world: { plan: false } }),
  sc('Workout', 'plan load error', {
    setup: (w) => {
      jest.spyOn(w.rawRepos.plan, 'get').mockRejectedValueOnce(new Error('disk'));
    },
  }),
  sc('HomeRest', 'rest layout', { world: { dayOffset: 2 } }),
  sc('WeekPlan', 'this week'),
  sc('WeekPlan', 'rest day today', { world: { dayOffset: 2 } }),
  sc('WeekPlan', 'no plan', { world: { plan: false } }),
  sc('Why', 'answers', { world: { painAreas: ['knees'] } }),
  sc('Why', 'no pain areas', { world: { painAreas: [] } }),
  sc('Plan', 'today', {}),
  sc('Plan', 'stretch day', { params: { planDayId: '1-4' } }),
  sc('Plan', 'walk day', { params: { planDayId: '1-2' } }),
  sc('Plan', 'ready-made', { params: { readyMadeId: 'full_body_starter' } }),
  sc('Plan', 'day not found', { params: { planDayId: '9-9' } }),
  sc('Library', 'all plans'),
  sc('Library', 'knee pain', { world: { painAreas: ['knees'] } }),
  sc('BodyPart', 'core', { params: { part: 'core' } }),
  sc('BodyPart', 'arms with wrist pain', { params: { part: 'arms' }, world: { painAreas: ['wrists'] } }),
  sc('Editor', 'today', {}),
  sc('Editor', 'from plan', { params: { planDayId: '1-0', from: 'plan' } }),
  sc('Editor', 'add a move', { params: { addExerciseId: 'squat' } }),
  sc('Editor', 'no session on day', { params: { planDayId: '1-4' } }),
  sc('Picker', 'add', { params: { slot: 1 }, setup: (w) => draftFor(w) }),
  sc('Picker', 'swap', {
    setup: (w) => draftFor(w),
    paramsFor: async (w) => {
      const { plan } = await todaysPlan(w);
      return { stepId: plan.steps.find((s) => s.phase === 'work')?.id };
    },
  }),
  sc('Parts', 'cool-down', { params: { part: 'cooldown' } }),
  sc('Parts', 'warm-up', { params: { part: 'warmup' } }),
  sc('Parts', 'work', { params: { part: 'work' } }),
  sc('Lunge', 'default', {}),
  sc('Lunge', 'with excluded move', { params: { excludedExerciseId: 'lunge' } }),
  sc('Exercise', 'squat', { params: { exerciseId: 'squat' } }),
  sc('Exercise', 'plank (hold)', { params: { exerciseId: 'plank' } }),
  sc('Exercise', 'Pro user', { params: { exerciseId: 'squat' }, world: { pro: {} } }),
  sc('Exercise', 'unknown move', { params: { exerciseId: 'nope' } }),
  sc('CheckIn', 'weekly check-in', { setup: (w) => loginHistory(w, 1) }),
  sc('CheckIn', 'no sessions', {}),

  // ----- Player family -----
  sc('Player', 'warm-up (real plan)', {
    needsDevice: ['Sound cues and haptics', 'Keep-awake', 'Screen rotation and the backgrounded timer'],
    setup: async (w) => {
      const { plan, planDay } = await todaysPlan(w);
      startSession(plan, { planWeek: 1, planDay });
      void useSessionStore;
    },
  }),
  sc('Player', 'work set', { setup: (w) => begin(w, { advanceMs: WORK_1 }) }),
  sc('Player', 'form-checkable move', { setup: (w) => begin(w, { advanceMs: CHECKABLE }) }),
  sc('Player', 'form-checkable move, Pro', { world: { pro: {} }, setup: (w) => begin(w, { advanceMs: CHECKABLE }) }),
  sc('Player', 'no session', {}),
  sc('Yoga', 'work pose', { setup: (w) => begin(w, { style: 'yoga', advanceMs: WORK_1 }) }),
  sc('Dance', 'work move', { setup: (w) => begin(w, { style: 'dance', advanceMs: WORK_1 }), needsDevice: ['Beat timing against the music tempo'] }),
  sc('Rest', 'between sets', { setup: (w) => begin(w, { advanceMs: REST_1 }) }),
  sc('Paused', 'paused by user', { setup: (w) => { begin(w, { advanceMs: WORK_1 }); w.harness.store.getState().pause('user'); } }),
  sc('Paused', 'paused for camera', { setup: (w) => { begin(w, { advanceMs: CHECKABLE }); w.harness.store.getState().pause('camera'); } }),
  sc('EndSession', 'confirm end', { setup: async (w) => { begin(w, { advanceMs: WORK_1 }); w.harness.store.getState().pause('user'); await w.harness.store.getState().requestEnd(); } }),
  sc('Feel', 'how did it feel', { setup: (w) => begin(w, { advanceMs: WORK_1 }) }),
  sc('SessionSettings', 'settings sheet', { setup: (w) => begin(w, { advanceMs: WORK_1 }) }),
  sc('Complete', 'finished session', { setup: (w) => begin(w, { advanceMs: END }) }),
  sc('Complete', 'finished, Pro', { world: { pro: {} }, setup: (w) => begin(w, { advanceMs: END }) }),
  sc('Desk', 'desk reset'),

  // ----- Form check and Pro -----
  sc('CameraPermission', 'not asked yet', { world: { camera: 'undetermined' }, needsDevice: ['The real Android and iOS camera permission prompt'] }),
  sc('CameraPermission', 'granted', { world: { camera: 'granted' } }),
  sc('FormCheck', 'pick a move, free', { needsDevice: ['Camera preview and framing guide'] }),
  sc('FormCheck', 'pick a move, Pro', { world: { pro: {} } }),
  sc('FormCheck', 'no free checks left', { world: { freeChecks: 0 }, setup: () => useEntitlements.setState({ freeChecks: 0 }) }),
  sc('LiveCheck', 'simulated camera', { needsDevice: ['Real pose landmarks, frame rate and heat (casafit-pose module)', 'Camera preview, mirrored front camera'], setup: async () => { await useFormCheck.getState().start(); } }),
  sc('LiveCheck', 'rep count reached', {
    setup: async (w) => {
      await useFormCheck.getState().start();
      for (const f of squatSequence({ reps: 5 })) w.pushFrame(f);
      await new Promise((r) => setTimeout(r, 5));
    },
  }),
  sc('FormResult', 'good result', { setup: () => useFormCheck.setState({ result: resultFor() as never }) }),
  sc('FormResult', 'needs work, no credits left', { setup: () => useFormCheck.setState({ result: resultFor({ creditsLeft: 0, rating: 'needs_work', repsClean: 2 }) as never }) }),
  sc('FormResult', 'Pro unlimited', { world: { pro: {} }, setup: () => useFormCheck.setState({ result: resultFor({ spend: 'pro', creditsLeft: 'unlimited' }) as never }) }),
  sc('FormResult', 'no result in memory', {}),
  sc('CameraDenied', 'permission denied', { world: { camera: 'denied' }, needsDevice: ['Opening system settings and coming back'] }),
  sc('NoCredits', 'free checks used', { world: { freeChecks: 0 } }),
  sc('Paywall', 'store offers', { needsDevice: ['The Play Store or App Store purchase sheet', 'Restore purchases against a real store account'] }),
  sc('Paywall', 'offline', { world: { offline: true } }),
  sc('ManagePro', 'active, renews', { world: { pro: {} } }),
  sc('ManagePro', 'trial', { world: { pro: { trial: true } } }),
  sc('ManagePro', 'cancelled', { world: { pro: { willRenew: false } } }),
  sc('ManagePro', 'billing issue', { world: { pro: { billingIssue: true } } }),
  sc('ManagePro', 'lapsed', { world: { pro: { active: false } } }),
  sc('ProWelcome', 'after purchase', { world: { pro: {} } }),
  sc('ProWelcome', 'after restore', { world: { pro: {} }, setup: () => useEntitlements.setState({ welcomeKind: 'restore' } as never) }),

  // ----- Nutrition -----
  sc('Nutrition', 'no profile'),
  sc('Nutrition', 'profile and plan', { setup: (w) => seedNutrition(w) }),
  sc('Nutrition', 'calories hidden', { world: { hideCalories: true }, setup: (w) => seedNutrition(w) }),
  sc('Nutrition', 'load error', { setup: async (w) => { await seedNutrition(w); jest.spyOn(w.rawRepos.nutrition, 'getProfile').mockRejectedValue(new Error('disk')); } }),
  sc('NutriProfile', 'new', {}),
  sc('NutriProfile', 'existing profile', { setup: (w) => seedNutrition(w, { allergies: ['peanut'] }) }),
  sc('NutriPlan', 'with plan', { setup: (w) => seedNutrition(w) }),
  sc('NutriPlan', 'no profile', {}),
  sc('FoodSearch', 'lunch', { params: { slot: 'lunch' } }),
  sc('FoodSearch', 'no slot', {}),
  sc('Meal', 'dal for lunch', { params: { mealId: content.searchFoods('dal', { kind: 'home', diet: 'veg' })[0]?.id, slot: 'lunch' } }),
  sc('Meal', 'no food chosen', { params: { slot: 'dinner' } }),
  sc('FoodEmpty', 'nothing logged'),

  // ----- Steps -----
  sc('Steps', 'granted', { world: { steps: 'granted' } }),
  sc('Steps', 'needs primer', { world: { steps: 'needs_primer' as never }, needsDevice: ['The Health Connect permission screen'] }),
  sc('Steps', 'denied', { world: { steps: 'denied' as never } }),
  sc('Steps', 'unavailable', { world: { steps: 'unavailable' as never } }),
  sc('StepsPermission', 'primer', { world: { steps: 'needs_primer' as never }, needsDevice: ['Health Connect and motion permission prompts'] }),
  sc('Reverse', 'ready', {}),
  sc('Reverse', 'blocked by a health flag', { setup: async (w) => {
      await w.rawRepos.profile.save({ healthFlags: ['pregnancy'] } as never);
    } }),
  sc('ReverseTimer', 'bout running', { needsDevice: ['Live step count, screen kept awake, haptic at the end'], setup: async () => { await useBout.getState().start({ usedBeforeS: 0, targetS: 600 }); } }),
  sc('ReverseTimer', 'no bout', {}),

  // ----- Progress and learn -----
  sc('Progress', 'with history', { world: { history: true }, noControls: true }),
  sc('Progress', 'empty', {}),
  sc('Progress', 'load error', { setup: (w) => { jest.spyOn(w.rawRepos.sessionLog, 'list').mockRejectedValue(new Error('disk')); } }),
  sc('ProgressEmpty', 'nothing yet'),
  sc('Recap', 'with history', { world: { history: true } }),
  sc('Recap', 'empty', {}),
  sc('Learn', 'myths'),
  sc('Myth', 'first myth', { params: { mythId: content.myths[0]?.id } }),
  sc('Myth', 'unknown id', { params: { mythId: 'nope' } }),
  sc('Concepts', 'first concept', { params: { conceptId: content.concepts[0]?.id } }),
  sc('Concepts', 'no id', {}),

  // ----- Settings -----
  sc('Settings', 'free user'),
  sc('Settings', 'Pro user', { world: { pro: {} } }),
  sc('Notify', 'permission granted', { world: { notifications: 'granted' }, needsDevice: ['The real notification permission prompt and scheduled delivery'] }),
  sc('Notify', 'permission denied', { world: { notifications: 'denied' } }),
  sc('Notify', 'not asked', { world: { notifications: 'undetermined' } }),
  sc('Language', 'languages'),
  sc('Privacy', 'consents', { setup: () => void usePreferences.getState() }),
  sc('Profile', 'signed in', {}),
  sc('Profile', 'no name', { world: { name: null } }),
  sc('EditProfile', 'edit'),
  sc('Help', 'closed', {}),
  sc('Help', 'privacy open', { params: { open: 'privacy' } }),
  sc('DeleteAccount', 'confirm', { needsDevice: ['Server-side delete and sign-out (needs the real API)'] }),
  sc('DeleteAccount', 'offline', { world: { offline: true } }),
];

void [COMEBACK_KEY, fakeSession, useVerifyOutcome];
