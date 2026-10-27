import { createTestDb } from '../db/testing/nodeSqliteDriver';
import { setRepositories } from './storage';
import { emptyDraft, normaliseDraft, useOnboarding } from './onboardingDraft';
import { defaultPreferences, usePreferences } from './preferences';
import { NOTICE_VERSION, useConsent } from './consent';

let close: () => void;
let repos: Awaited<ReturnType<typeof createTestDb>>['repos'];

beforeEach(async () => {
  const db = await createTestDb();
  repos = db.repos;
  close = () => db.driver.close();
  setRepositories(repos);
  useOnboarding.setState({ draft: emptyDraft(), hydrated: false });
  usePreferences.setState({ ...defaultPreferences(), hydrated: false });
  useConsent.setState({ latest: {}, hydrated: false });
});
afterEach(() => {
  setRepositories(null);
  close();
});

describe('onboarding draft', () => {
  it('survives an app kill: a fresh store reads back every answer', async () => {
    await useOnboarding.getState().update({ birthYear: 1996, goal: 'stay_fit', daysPerWeek: 5, painAreas: ['knees'] });
    useOnboarding.setState({ draft: emptyDraft(), hydrated: false }); // simulate cold start
    await useOnboarding.getState().hydrate();
    expect(useOnboarding.getState().draft).toMatchObject({ birthYear: 1996, daysPerWeek: 5, painAreas: ['knees'] });
  });

  it('keeps the draft consistent', () => {
    const d = { ...emptyDraft(), goal: 'stay_fit' as const, bodyParts: ['core', 'legs', 'arms'], mix: { yoga: 2 }, styles: ['yoga' as const] };
    expect(normaliseDraft(d)).toMatchObject({ bodyParts: [], mix: {} });
    const e = { ...emptyDraft(), goal: 'body_part' as const, bodyParts: ['core', 'legs', 'arms'] };
    expect(normaliseDraft(e).bodyParts).toEqual(['core', 'legs']);
  });

  it('health consent starts unticked and clears when the last flag is removed', async () => {
    expect(useOnboarding.getState().draft.healthConsent).toBeNull();
    await useOnboarding.getState().update({ healthFlags: ['heart_bp'], healthConsent: { granted: true, at: 'now' } });
    expect(useOnboarding.getState().draft.healthConsent?.granted).toBe(true);
    await useOnboarding.getState().update({ healthFlags: [] });
    expect(useOnboarding.getState().draft.healthConsent).toBeNull();
  });

  it('finish clears memory and storage', async () => {
    await useOnboarding.getState().update({ birthYear: 1990 });
    await useOnboarding.getState().finish();
    expect(await repos.onboardingDraft.load()).toBeNull();
    expect(useOnboarding.getState().draft.birthYear).toBeNull();
  });

  it('rapid updates land in order', async () => {
    const s = useOnboarding.getState();
    await Promise.all([s.update({ daysPerWeek: 3 }), s.update({ daysPerWeek: 6 }), s.update({ daysPerWeek: 7 })]);
    expect((await repos.onboardingDraft.load())?.daysPerWeek).toBe(7);
  });
});

describe('preferences', () => {
  it('shows calories by default and persists the hide choice (D7)', async () => {
    expect(usePreferences.getState().showCalories).toBe(true);
    await usePreferences.getState().setShowCalories(false);
    usePreferences.setState({ ...defaultPreferences(), hydrated: false });
    await usePreferences.getState().hydrate();
    expect(usePreferences.getState().showCalories).toBe(false);
  });

  it('merges stored partial values over defaults and ignores corrupt data', async () => {
    await repos.prefs.set('preferences.v1', JSON.stringify({ session: { restS: 30 } }));
    await usePreferences.getState().hydrate();
    expect(usePreferences.getState().session).toMatchObject({ restS: 30, voice: true });
    await repos.prefs.set('preferences.v1', '{nope');
    await expect(usePreferences.getState().hydrate()).resolves.toBeUndefined();
  });

  it('persists session and notification prefs', async () => {
    await usePreferences.getState().setSession({ quiet: true });
    await usePreferences.getState().setNotifications({ enabled: true, time: '06:30' });
    usePreferences.setState({ ...defaultPreferences() });
    await usePreferences.getState().hydrate();
    expect(usePreferences.getState().session.quiet).toBe(true);
    expect(usePreferences.getState().notifications).toMatchObject({ enabled: true, time: '06:30' });
  });
});

describe('consent store', () => {
  it('has no consent until the user grants it', async () => {
    await useConsent.getState().hydrate();
    expect(useConsent.getState().has('health_answers')).toBe(false);
  });

  it('records grant then withdrawal as separate rows and persists latest', async () => {
    const c = useConsent.getState();
    const g = await c.record('health_answers', true, 'onboarding');
    expect(g.noticeVersion).toBe(NOTICE_VERSION);
    expect(useConsent.getState().has('health_answers')).toBe(true);
    await c.record('health_answers', false, 'privacy_screen');
    expect(useConsent.getState().has('health_answers')).toBe(false);
    expect(await repos.consent.history('health_answers')).toHaveLength(2);
    useConsent.setState({ latest: {} });
    await useConsent.getState().hydrate();
    expect(useConsent.getState().has('health_answers')).toBe(false);
  });
});
