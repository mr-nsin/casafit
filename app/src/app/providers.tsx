import { useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { casafitDark, casafitLight } from '@/theme';
import { toNavigationTheme } from './navigationTheme';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, networkMode: 'offlineFirst' } },
  });
}

/** Theme, data, gestures, safe area and the navigation container. Fonts are loaded by the caller. */
export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const paper = dark ? casafitDark : casafitLight;
  const navTheme = useMemo(() => toNavigationTheme(paper, dark), [paper, dark]);
  const client = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <PaperProvider theme={paper}>
            <NavigationContainer theme={navTheme}>{children}</NavigationContainer>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
