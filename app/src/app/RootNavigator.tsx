import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { VerifyScreen } from '@/screens/Verify';
import { WelcomeScreen } from '@/screens/Welcome';
import { PlaceholderScreen } from './PlaceholderScreen';
import { rootRouteLanes } from './routes';
import { TabNavigator } from './TabNavigator';
import type { RootRouteName, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Routes that have a real screen; every other route in `rootRouteLanes` is a placeholder. */
type ImplementedRoute = 'Welcome' | 'Verify';
type PlaceholderRoute = Exclude<RootRouteName, 'Main' | ImplementedRoute>;

const implemented: ReadonlySet<string> = new Set<ImplementedRoute>(['Welcome', 'Verify']);
export const placeholderRoutes = (Object.keys(rootRouteLanes) as PlaceholderRoute[]).filter(
  (name) => !implemented.has(name),
);

export function RootNavigator({ initialRouteName }: { initialRouteName: 'Welcome' | 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
      {placeholderRoutes.map((name) => (
        <Stack.Screen key={name} name={name} component={PlaceholderScreen} />
      ))}
    </Stack.Navigator>
  );
}
