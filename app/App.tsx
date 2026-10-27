import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { AppProviders, RootNavigator, useAppFonts } from '@/app';
import { useAuth } from '@/state/auth';

export type { RootStackParamList } from '@/app';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsReady = useAppFonts();
  const hydrate = useAuth((s) => s.hydrate);
  const hasSession = useAuth((s) => !!s.session);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // A SecureStore failure must not block launch; treat it as signed out.
    hydrate()
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, [hydrate]);

  const ready = fontsReady && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <RootNavigator initialRouteName={hasSession ? 'Main' : 'Welcome'} />
    </AppProviders>
  );
}
