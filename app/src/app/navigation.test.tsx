import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { casafitLight } from '@/theme';
import { placeholderRoutes, RootNavigator } from './RootNavigator';
import { rootRouteLanes, tabRouteLanes } from './routes';

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

async function renderNav(initialRouteName: 'Welcome' | 'Main') {
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

  it('registers a placeholder for every route without a real screen', () => {
    expect(placeholderRoutes).not.toContain('Welcome');
    expect(placeholderRoutes).not.toContain('Verify');
    expect(placeholderRoutes).toHaveLength(Object.keys(rootRouteLanes).length - 2);
  });
});

describe('RootNavigator', () => {
  it('opens on Welcome when signed out', async () => {
    await renderNav('Welcome');
    expect(screen.getByTestId('welcome-cta')).toBeTruthy();
  });

  it('opens on the Workout tab when signed in', async () => {
    await renderNav('Main');
    expect(screen.getByText('Home · placeholder')).toBeTruthy();
  });
});
