// Phone or email OTP. Mirrors project/m3-verify.dc.html.
// See docs/plans/onboarding.md task 1 and task 9 for the acceptance criteria.

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../App';
import { useSendCode, useVerifyCode } from '@/api/auth';
import { light, space, radius } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Verify'>;

export function VerifyScreen({ navigation }: Props) {
  const [channel, setChannel] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const send = useSendCode();
  const verify = useVerifyCode();

  const sent = !!send.data;
  const canSend = !!identifier && !send.isPending;
  const canVerify = sent && code.length === 6 && !verify.isPending;

  async function onSend() {
    const body = channel === 'phone' ? { phone: identifier } : { email: identifier };
    await send.mutateAsync(body);
  }

  async function onVerify() {
    const body =
      channel === 'phone'
        ? { phone: identifier, code }
        : { email: identifier, code };
    await verify.mutateAsync(body);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <View style={styles.root}>
      <Text variant="headlineLarge" style={styles.title}>Verify your number</Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Reinstall or switch phones and your plan and free form checks come right back.
      </Text>

      <SegmentedButtons
        value={channel}
        onValueChange={(v) => setChannel(v as 'phone' | 'email')}
        buttons={[
          { value: 'phone', label: 'Phone' },
          { value: 'email', label: 'Email' },
        ]}
        style={styles.tabs}
      />

      <TextInput
        label={channel === 'phone' ? 'Mobile number' : 'Email address'}
        mode="outlined"
        inputMode={channel === 'phone' ? 'tel' : 'email'}
        autoCapitalize="none"
        value={identifier}
        onChangeText={setIdentifier}
        testID="verify-identifier"
      />

      {sent && (
        <TextInput
          label="6-digit code"
          mode="outlined"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={{ marginTop: space.m }}
          testID="verify-code"
        />
      )}

      {send.isError && (
        <Text variant="bodySmall" style={styles.error}>
          {(send.error as Error).message}
        </Text>
      )}
      {verify.isError && (
        <Text variant="bodySmall" style={styles.error}>
          That code is not right.
        </Text>
      )}

      <Button
        mode="contained"
        onPress={sent ? onVerify : onSend}
        disabled={sent ? !canVerify : !canSend}
        style={styles.cta}
        testID="verify-cta"
      >
        {sent ? 'Verify and continue' : 'Send code'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xxl },
  title: { marginTop: space.xxl },
  sub: { marginTop: space.s, color: light.osv },
  tabs: { marginVertical: space.xl },
  error: { color: light.er, marginTop: space.s },
  cta: {
    position: 'absolute',
    left: space.xxl,
    right: space.xxl,
    bottom: space.xxl,
    height: 56,
    justifyContent: 'center',
    borderRadius: radius.round,
  },
});
