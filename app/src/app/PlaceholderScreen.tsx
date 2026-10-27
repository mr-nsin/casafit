// Stands in for every route until its lane builds the real screen.
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Text, useTheme } from 'react-native-paper';

import { space } from '@/theme';
import { rootRouteLanes, tabRouteLanes, type Lane } from './routes';
import type { RootRouteName, TabRouteName } from './types';

function laneOf(name: string): Lane {
  if (name in rootRouteLanes) return rootRouteLanes[name as Exclude<RootRouteName, 'Main'>];
  if (name in tabRouteLanes) return tabRouteLanes[name as TabRouteName];
  return 'shell';
}

export function PlaceholderScreen() {
  const route = useRoute();
  const theme = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      testID="placeholder-screen"
    >
      <Text variant="headlineLarge" style={{ color: theme.colors.onBackground }}>
        {route.name}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Lane: {laneOf(route.name)}. Not built yet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xxl, justifyContent: 'center', gap: space.s },
});
