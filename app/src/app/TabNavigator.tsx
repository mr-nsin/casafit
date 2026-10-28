import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import { HomeScreen } from '@/screens/Home';
import { nutritionTab } from '../features/nutrition';
import { progressRoutes } from '../features/progress';
import { tabIcons, tabLabels } from './routes';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="Workout"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: tabLabels[route.name],
        tabBarActiveTintColor: theme.colors.onSecondaryContainer,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface },
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name={tabIcons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Workout" component={HomeScreen} />
      <Tab.Screen name="Nutrition" component={nutritionTab} />
      <Tab.Screen name="Progress" component={progressRoutes.Progress.component} />
    </Tab.Navigator>
  );
}
