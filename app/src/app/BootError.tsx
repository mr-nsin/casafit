// Shown when the on-device database cannot be opened. Plain React Native so it works with no providers.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { light, radius, space, type } from '../theme';

export function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root} testID="boot-error">
      <Text accessibilityRole="header" style={[type.headline, { color: light.on }]}>
        We could not open your data
      </Text>
      <Text style={[type.body, { color: light.osv }]}>
        Nothing was lost. Close other apps to free some space, then try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        testID="boot-retry"
        onPress={onRetry}
        style={styles.button}
      >
        <Text style={[type.title, { color: light.op }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: light.bg, padding: space.xxl, justifyContent: 'center', gap: space.l },
  button: {
    minHeight: 48,
    borderRadius: radius.round,
    backgroundColor: light.p,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
});
