// Language and voice (m3-language). English is the only language with strings today. The
// other choices are saved so they apply when translations ship, and the screen says so kindly.

import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { usePreferences } from '../../state/preferences';
import { Icon, RadioList, StatusBanner, Text, space } from '../../ui';
import { Page } from './Page';
import { useProfileData } from './hooks';
import { LANGUAGES, languageFor, languageSubtitle } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LanguageScreen() {
  const nav = useNavigation<Nav>();
  const { profile, save } = useProfileData();
  const setSession = usePreferences((s) => s.setSession);
  const current = languageFor(profile?.locale);

  const choose = async (id: string) => {
    await save({ locale: id });
    await setSession({ lang: id });
  };

  return (
    <Page topBar={{ title: 'Language and voice', leading: 'back', onLeading: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main')) }}>
      <Text color="osv">The app and your voice coach use the same language. Exercise names stay in English with a short local explanation.</Text>
      <RadioList
        value={current.id}
        onChange={(id) => void choose(id)}
        options={LANGUAGES.map((l) => ({
          id: l.id,
          native: l.native,
          label: languageSubtitle(l),
          badge: l.available ? undefined : 'Coming soon',
        }))}
      />
      {!current.available ? (
        <StatusBanner variant="info" icon="translate">
          {current.english} is coming soon. CasaFit stays in English for now. We saved your choice and will switch when it is ready.
        </StatusBanner>
      ) : null}
      {current.id === 'hi-IN' ? (
        <View accessible accessibilityLabel="Preview: Knees out, in Hindi" style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Icon name="record_voice_over" color="osv" />
          <Text variant="bodySmall" color="osv" style={{ flex: 1 }}>
            Preview: &quot;घुटनों को बाहर रखें&quot; · Knees out
          </Text>
        </View>
      ) : null}
    </Page>
  );
}
