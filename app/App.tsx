import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { casafitDark, casafitLight } from '@/theme';
import { useAuth } from '@/state/auth';
import { WelcomeScreen } from '@/screens/Welcome';
import { VerifyScreen } from '@/screens/Verify';
import { HomeScreen } from '@/screens/Home';

export type RootStackParamList = {
  Welcome: undefined;
  Verify: { phone?: string; email?: string };
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? casafitDark : casafitLight;
  const hydrate = useAuth((s) => s.hydrate);
  const hasSession = useAuth((s) => !!s.session);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <NavigationContainer theme={{ ...theme, dark: scheme === 'dark', fonts: {} as any }}>
          <Stack.Navigator
            initialRouteName={hasSession ? 'Home' : 'Welcome'}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </QueryClientProvider>
  );
}
