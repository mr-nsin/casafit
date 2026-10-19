// First screen. Mirrors project/m3-welcome.dc.html.
// See docs/plans/onboarding.md task 5 for the acceptance criteria.

import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../App';
import { light, space, radius } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="displayLarge" style={styles.minutes}>15</Text>
        <Text variant="titleMedium">minutes</Text>
      </View>
      <Text variant="headlineMedium" style={styles.headline}>
        A whole workout, at home, with nothing but you.
      </Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Every session starts with a matched warm-up and ends with a cool-down.
      </Text>
      <View style={styles.bar}>
        <View style={[styles.seg, { flex: 2, backgroundColor: light.tc }]}>
          <Text variant="labelSmall">Warm-up</Text>
          <Text variant="labelSmall" style={styles.strong}>2</Text>
        </View>
        <View style={[styles.seg, { flex: 11, backgroundColor: light.p }]}>
          <Text variant="labelSmall" style={{ color: light.op }}>Work</Text>
          <Text variant="labelSmall" style={[styles.strong, { color: light.op }]}>11 min</Text>
        </View>
        <View style={[styles.seg, { flex: 2, backgroundColor: light.sc }]}>
          <Text variant="labelSmall">Cool</Text>
          <Text variant="labelSmall" style={styles.strong}>2</Text>
        </View>
      </View>
      <Button
        mode="contained"
        onPress={() => navigation.navigate('Verify', {})}
        testID="welcome-cta"
        style={styles.cta}
      >
        Get my 15-minute plan
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xxl, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: space.xxl * 2 },
  minutes: { fontSize: 128, lineHeight: 128, fontWeight: '800' as const, color: light.opc },
  headline: { marginTop: space.xxl },
  sub: { marginTop: space.m, color: light.osv },
  bar: {
    flexDirection: 'row',
    height: 52,
    borderRadius: radius.l,
    overflow: 'hidden',
    marginTop: space.xl,
  },
  seg: { justifyContent: 'center', paddingHorizontal: space.m },
  strong: { fontWeight: '700' as const },
  cta: { height: 56, justifyContent: 'center', borderRadius: radius.round, marginBottom: space.xxl },
});
