import { act, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlaceholderScreen } from './PlaceholderScreen';
import { casafitLight } from '@/theme';
import { createTestDb } from '../db/testing/nodeSqliteDriver';
import { createFakeStepCounter } from '../services/step-counter';
import { createFakeKeepAwake } from '../services/keep-awake';
import { setRepositories } from '../state/storage';
import { useAuth } from '../state/auth';
import { nutritionTab } from '../features/nutrition';
import { progressRoutes } from '../features/progress';
import { bootstrap } from './bootstrap';
import { laneRoutes, placeholderRoutes, RootNavigator, type InitialRoute } from './RootNavigator';
import { implementedRootRoutes, rootRouteLanes, tabRouteLanes } from './routes';

// Every route named in docs/plans/implementation.md section 1, minus the three
// that live in tabs or on the Main container (Home, Nutrition, Progress).
const sectionOneRoutes = [
  'Splash', 'Welcome', 'Age', 'Verify', 'Offline', 'WelcomeBack', 'Goals', 'About', 'Mix',
  'Health', 'Building', 'WeekOne',
  'HomeRest', 'WeekPlan', 'Why', 'Library', 'BodyPart', 'Plan', 'Player', 'Rest', 'Paused',
  'EndSession', 'Editor', 'Picker', 'Parts', 'Lunge', 'Complete', 'Yoga', 'Dance', 'Desk',
  'Exercise', 'SessionSettings', 'Feel', 'CheckIn',
  'CameraPermission', 'FormCheck', 'LiveCheck', 'FormResult', 'CameraDenied', 'NoCredits',
  'Paywall', 'ManagePro', 'ProWelcome',
  'NutriProfile', 'NutriPlan', 'FoodSearch', 'Meal', 'FoodEmpty',
  'Steps', 'StepsPermission', 'Reverse', 'ReverseTimer', 'ProgressEmpty', 'Recap', 'Learn',
  'Myth', 'Concepts',
  'Settings', 'Notify', 'Language', 'Privacy', 'Profile', 'EditProfile', 'Help', 'DeleteAccount',
];

async function renderNav(initialRouteName: InitialRoute) {
  return await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <PaperProvider theme={casafitLight}>
        <NavigationContainer>
          <RootNavigator initialRouteName={initialRouteName} />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

describe('route map', () => {
  it('covers every route in the plan', () => {
    expect(Object.keys(rootRouteLanes).sort()).toEqual([...sectionOneRoutes].sort());
  });

  it('has the three tabs', () => {
    expect(Object.keys(tabRouteLanes)).toEqual(['Workout', 'Nutrition', 'Progress']);
  });

  it('registers a placeholder only for routes without a lane screen', () => {
    for (const name of implementedRootRoutes) expect(placeholderRoutes).not.toContain(name);
    expect(placeholderRoutes).toHaveLength(Object.keys(rootRouteLanes).length - implementedRootRoutes.length);
  });

  it('resolves every implemented route to a real component, never the placeholder', () => {
    expect(Object.keys(laneRoutes).sort()).toEqual([...implementedRootRoutes].sort());
    for (const name of implementedRootRoutes) {
      const entry = laneRoutes[name];
      expect(entry).toBeDefined();
      expect(['function', 'object']).toContain(typeof entry!.component);
      expect(entry!.component).not.toBe(PlaceholderScreen);
    }
  });

  it('wires the lane tab roots', () => {
    expect(nutritionTab).toBeDefined();
    expect(progressRoutes.Progress.component).toBeDefined();
  });
});

describe('cold start', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    setRepositories(null);
    useAuth.setState({ session: null });
  });

  it('reaches Splash with a fake DB, then Welcome when signed out', async () => {
    await bootstrap({
      openDatabase: async () => {
        const { driver, repos } = await createTestDb();
        return { driver, repos };
      },
      hydrateAuth: async () => undefined,
      stepCounter: () => createFakeStepCounter(),
      keepAwake: () => createFakeKeepAwake(),
      send: async () => ({ status: 200 }),
    });
    await renderNav('Splash');
    expect(screen.getByLabelText('CasaFit, loading')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Get my 15-minute plan')).toBeTruthy();
  });
});

describe('RootNavigator', () => {
  it('opens on Welcome when signed out', async () => {
    await renderNav('Welcome');
    expect(screen.getByText('Get my 15-minute plan')).toBeTruthy();
  });

  it('opens on the Workout tab when signed in', async () => {
    await renderNav('Main');
    expect(screen.getByText('Home · placeholder')).toBeTruthy();
  });
});
