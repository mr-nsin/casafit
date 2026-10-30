import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { fakeSession } from '../../services/auth';
import { useAuth } from '../../state/auth';
import { emptyDraft, useOnboarding } from '../../state/onboardingDraft';
import { getRepositories } from '../../state/storage';
import { useConsent } from '../../state/consent';
import { onboardingRoutes } from './index';
import { configureOnboardingDeps } from './deps';
import { mockNav, setupDb } from './testkit';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => require('./testkit').mockNav }));

let close: () => void;
beforeEach(async () => {
  ({ close } = await setupDb());
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
  close();
});

const tap = async (label: string | RegExp) => fireEvent.press(screen.getByLabelText(label));
const lastNav = () => mockNav.navigate.mock.calls.at(-1)?.[0];

describe('draft survives an app kill', () => {
  it('reloads every answer from storage', async () => {
    await useOnboarding.getState().update({ birthYear: 1995, confirmed18: true, goal: 'stay_fit', styles: ['yoga', 'normal'], daysPerWeek: 5, painAreas: ['back'], heightCm: 170 });
    useOnboarding.setState({ draft: emptyDraft(), hydrated: false }); // the process dies
    await useOnboarding.getState().hydrate();
    expect(useOnboarding.getState().draft).toMatchObject({ birthYear: 1995, daysPerWeek: 5, painAreas: ['back'], heightCm: 170, styles: ['yoga', 'normal'] });
  });
});

describe('first run, three styles, a health flag', () => {
  it('walks Age, Goals, About, Mix, Health, Building and WeekOne in D4 order', async () => {
    jest.useFakeTimers();
    const R = onboardingRoutes;

    // Age
    await useOnboarding.getState().update({ birthYear: 1996 });
    let view = await render(<R.Age.component />);
    await tap('I confirm I am 18 or older.');
    await waitFor(() => expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(false));
    await tap('Continue');
    expect(lastNav()).toBe('Verify');
    await view.unmount();

    // Verify is covered in verify.test.tsx; it resets the stack to Goals once signed in.
    useAuth.setState({ session: fakeSession() });

    // Goals
    view = await render(<R.Goals.component />);
    await tap('Stay fit, full body');
    for (const s of ['Normal', 'Dance', 'Yoga']) await tap(s);
    await waitFor(() => expect(screen.getByLabelText('Next: about you').props.accessibilityState.disabled).toBe(false));
    await tap('Next: about you');
    expect(lastNav()).toBe('About');
    await view.unmount();

    // About: pick a flag, four days, a knee note
    view = await render(<R.About.component />);
    await tap('Knees');
    await tap('Pregnancy or postpartum');
    await tap('Continue');
    await waitFor(() => expect(lastNav()).toBe('Mix'));
    await view.unmount();

    // Mix then Health (flag set)
    view = await render(<R.Mix.component />);
    await waitFor(() => expect(screen.getByText('4 of 4 days assigned')).toBeTruthy());
    await tap('Use this mix');
    expect(lastNav()).toBe('Health');
    await view.unmount();

    // Back from About to Goals keeps everything
    view = await render(<R.Goals.component />);
    expect(screen.getByLabelText('Dance').props.accessibilityState.checked).toBe(true);
    await view.unmount();

    // Health: no tick, still continue
    view = await render(<R.Health.component />);
    await tap('Build my gentler plan');
    await waitFor(() => expect(lastNav()).toBe('Building'));
    expect(useConsent.getState().latest.health_answers?.granted).toBe(false);
    await view.unmount();

    // Building
    const sync = jest.fn(async () => undefined);
    configureOnboardingDeps({ syncPlan: sync, startToday: () => 'Player' });
    view = await render(<R.Building.component />);
    for (let i = 0; i < 12; i += 1) await act(async () => void jest.advanceTimersByTime(700));
    expect(mockNav.replace).toHaveBeenCalledWith('WeekOne');
    await view.unmount();

    const plan = await getRepositories().plan.get();
    expect(plan?.variant).toBe('gentler');
    expect(await getRepositories().onboardingDraft.load()).toBeNull();
    expect(JSON.stringify(sync.mock.calls)).not.toMatch(/pregnan|knee|health|pain/i);

    // WeekOne
    await render(<R.WeekOne.component />);
    await act(async () => void jest.advanceTimersByTime(10));
    expect(screen.getByText('Your plan is ready')).toBeTruthy();
    await tap("Start today's session");
    expect(mockNav.reset).toHaveBeenLastCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'Player' }] });
  });
});
