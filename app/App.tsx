import 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { AppProviders, RootNavigator, useAppFonts } from '@/app';
import { BootErrorScreen } from '@/app/BootError';
import { bootstrap } from '@/app/bootstrap';

export type { RootStackParamList } from '@/app';

void SplashScreen.preventAutoHideAsync();

type Boot = 'loading' | 'ready' | 'failed';

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
      <RootNavigator initialRouteName="Splash" />
    </AppProviders>
  );
}
