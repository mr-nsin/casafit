import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '@/screens/Home';
import { nutritionTab } from '../features/nutrition';
import { progressRoutes } from '../features/progress';
import { Icon } from '../ui/primitives';
import { elevation, fonts } from '../ui/tokens';
import { useTokens } from '../ui/useTokens';
import { tabIcons, tabLabels } from './routes';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const t = useTokens();
  return (
    <Tab.Navigator
      initialRouteName="Workout"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: tabLabels[route.name],
        tabBarActiveTintColor: t.on,
        tabBarInactiveTintColor: t.osv,
        tabBarLabelStyle: { fontFamily: fonts.ui600, fontSize: 12 },
        tabBarStyle: { backgroundColor: t.el, borderTopColor: t.olv, borderTopWidth: 1, ...elevation.bar },
        // Lucide has no filled icons: the selected tab is a terracotta icon on an apricot pill.
        tabBarIcon: ({ focused }) => (
          <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? t.pc : 'transparent' }}>
            <Icon name={tabIcons[route.name].replace(/-/g, '_')} color={focused ? 'p' : 'osv'} size={22} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Workout" component={HomeScreen} />
      <Tab.Screen name="Nutrition" component={nutritionTab} />
      <Tab.Screen name="Progress" component={progressRoutes.Progress.component} />
    </Tab.Navigator>
  );
}
