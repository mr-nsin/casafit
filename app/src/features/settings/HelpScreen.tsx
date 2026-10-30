// Help and support (m3-help): searchable FAQ kept in the app, so it works offline, plus an
// email row. Chat needs a vendor that is not chosen yet, so it opens an email for now.

import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { Accordion, ListRow, SearchField, SectionHeader, StatusBanner, Text, space } from '../../ui';
import { Page } from './Page';
import { getSettingsDeps } from './deps';
import { appVersion } from './hooks';
import { FAQ, SUPPORT_EMAIL, supportMailto } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HelpScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute();
  const initial = (route.params as { open?: string } | undefined)?.open;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(initial ?? FAQ[0]!.id);
  const [mailFailed, setMailFailed] = useState(false);

  const q = query.trim().toLowerCase();
  const items = q ? FAQ.filter((f) => `${f.question} ${f.answer}`.toLowerCase().includes(q)) : FAQ;

  const mail = async (subject?: string) => {
    setMailFailed(false);
    const url = supportMailto(appVersion()).replace(/subject=[^&]*/, `subject=${encodeURIComponent(subject ?? `CasaFit ${appVersion()} support`)}`);
    try {
      await getSettingsDeps().openUrl(url);
    } catch {
      setMailFailed(true);
    }
  };

  return (
    <Page topBar={{ title: 'Help and support', leading: 'back', onLeading: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main')) }}>
      <SearchField label="Search help" placeholder="Search help" value={query} onChange={setQuery} />

      <View>
        <SectionHeader title="Common questions" />
        {items.length === 0 ? (
          <Text color="osv" style={{ paddingVertical: space.l }}>
            Nothing matches that yet. Try another word, or email us below.
          </Text>
        ) : (
          items.map((f) => <Accordion key={f.id} question={f.question} answer={f.answer} expanded={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />)
        )}
      </View>

      <View>
        <SectionHeader title="Still stuck?" />
        <ListRow icon="chat" title="Chat with us" subtitle="Opens an email for now" trailing="external" onPress={() => void mail(`CasaFit ${appVersion()} chat request`)} />
        <ListRow icon="mail" title="Email support" subtitle={SUPPORT_EMAIL} trailing="external" onPress={() => void mail()} />
        {mailFailed ? (
          <StatusBanner variant="info" icon="mail">
            We could not open your email app. You can write to us at {SUPPORT_EMAIL}.
          </StatusBanner>
        ) : null}
      </View>

      <Text variant="bodySmall" color="osv" style={{ textAlign: 'center' }}>
        CasaFit {appVersion()}
      </Text>
    </Page>
  );
}
