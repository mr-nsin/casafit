// Delete account (m3-deleteacct): a dialog over a scrim. The server deletes first; only when it
// confirms do we wipe this phone. Offline or on failure nothing is touched and the user can retry.

import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { ConfirmDialog, type DialogAction } from '../../ui';
import { deleteMyAccount, failureMessage, useClearQueryCache } from './account';
import { useBusy, useDataExport } from './hooks';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CONFIRM_BODY =
  'This removes your plan, food log, step history, session logs and free-check balance from CasaFit, on this phone and on our servers. It cannot be undone. ' +
  'We keep a scrambled code of your number for 180 days so deleting does not reset free checks. ' +
  'Your store subscription is not cancelled: do that in the Play Store or App Store. You can export your data first.';

export function DeleteAccountScreen() {
  const nav = useNavigation<Nav>();
  const clearCache = useClearQueryCache();
  const [busy, run] = useBusy();
  const [failure, setFailure] = useState<string | null>(null);
  const exporter = useDataExport();

  const keep = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main'));

  const remove = () =>
    run(async () => {
      setFailure(null);
      const r = await deleteMyAccount();
      if (!r.ok) {
        setFailure(failureMessage('delete', r.reason));
        return;
      }
      clearCache();
      nav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    });

  const body = busy
    ? 'Deleting your account. This takes a moment.'
    : failure ?? (exporter.message ? `${exporter.message}\n\n${CONFIRM_BODY}` : exporter.done ? `Your export is ready to save.\n\n${CONFIRM_BODY}` : CONFIRM_BODY);

  const actions: DialogAction[] = busy
    ? []
    : failure
      ? [
          { label: 'Try again', onPress: () => void remove(), variant: 'destructive' },
          { label: 'Keep my account', onPress: keep, variant: 'filled' },
        ]
      : [
          { label: 'Keep my account', onPress: keep, variant: 'filled' },
          { label: exporter.busy ? 'Getting your data...' : 'Export my data first', onPress: () => void (exporter.busy ? undefined : exporter.start()), variant: 'tonal', icon: 'download' },
          { label: 'Delete everything', onPress: () => void remove(), variant: 'destructive' },
        ];

  return (
    <View style={{ flex: 1 }}>
      <ConfirmDialog visible icon="delete_forever" title="Delete your account?" body={body} actions={actions} onDismiss={busy ? undefined : keep} />
    </View>
  );
}
