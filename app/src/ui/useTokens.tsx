import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { palettes, type Scheme, type Tokens } from './tokens';
import { paperTheme } from './paperTheme';

type Ctx = { scheme: Scheme; tokens: Tokens };
const TokensContext = createContext<Ctx>({ scheme: 'light', tokens: palettes.light });

/** Provides tokens and the Paper MD3 theme. `scheme` overrides the system setting. */
export function UIProvider({ scheme, children }: { scheme?: Scheme; children: React.ReactNode }) {
  const system = useColorScheme();
  const resolved: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => ({ scheme: resolved, tokens: palettes[resolved] }), [resolved]);
  const theme = useMemo(() => paperTheme(resolved), [resolved]);
  return (
    <TokensContext.Provider value={value}>
      <PaperProvider theme={theme}>{children}</PaperProvider>
    </TokensContext.Provider>
  );
}

/** Colour roles for the active scheme. Works without a provider (light). */
export function useTokens(): Tokens {
  return useContext(TokensContext).tokens;
}
export function useScheme(): Scheme {
  return useContext(TokensContext).scheme;
}
