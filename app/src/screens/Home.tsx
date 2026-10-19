// Placeholder. The real home screen comes in the session lane.
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { space } from '@/theme';

export function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text variant="headlineLarge">Home · placeholder</Text>
      <Text variant="bodyMedium">Session lane will fill this in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xxl, justifyContent: 'center' },
});
