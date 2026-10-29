import 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'react-native';

import { AppProviders, RootNavigator, useAppFonts } from '@/app';
import { BootErrorScreen } from '@/app/BootError';
import { bootstrap } from '@/app/bootstrap';
import { useScheme } from '@/ui';

export type { RootStackParamList } from '@/app';

void SplashScreen.preventAutoHideAsync();

type Boot = 'loading' | 'ready' | 'failed';

/** Dark icons on light screens and the reverse, following the app theme rather than the system. */
function ThemedStatusBar() {
  return <StatusBar barStyle={useScheme() === 'dark' ? 'light-content' : 'dark-content'} />;
}

export default function App() {
  const fontsReady = useAppFonts();
  const [boot, setBoot] = useState<Boot>('loading');

  const start = useCallback(() => {
    setBoot('loading');
    // Only a database failure rejects; everything else degrades inside bootstrap.
    bootstrap().then(
      () => setBoot('ready'),
      () => setBoot('failed'),
    );
  }, []);

  useEffect(start, [start]);

  const ready = fontsReady && boot !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  if (boot === 'failed') return <BootErrorScreen onRetry={start} />;

  return (
    <AppProviders>
      <ThemedStatusBar />
      <RootNavigator initialRouteName="Splash" />
    </AppProviders>
  );
}
