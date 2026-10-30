import { createDevAuth } from './dev';
import { createUnconfiguredAuth } from './none';
import { createSupabaseAuth } from './supabase';
import type { AuthProvider } from './types';

export * from './types';
export { createFakeAuth, fakeSession, FAKE_TOKEN } from './fake';
export type { FakeAuth } from './fake';
export { createDevAuth, decodeDevToken } from './dev';
export { createSupabaseAuth, mapSession, parseCallback, STORAGE_KEY } from './supabase';
export { createUnconfiguredAuth } from './none';
export { createChunkedStorage } from './secureStorage';

export interface AuthEnv {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  devToken?: string;
  /** True in development builds. The dev token is ignored when false. */
  dev: boolean;
}

/** Metro inlines `process.env.EXPO_PUBLIC_*` only when written out like this. */
export function readAuthEnv(): AuthEnv {
  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    devToken: process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN,
    dev: __DEV__,
  };
}

/** Dev token first (development builds only), then Supabase, then the "not set up" provider. */
export function createDefaultAuth(env: AuthEnv = readAuthEnv()): AuthProvider {
  if (env.dev && env.devToken) {
    const dev = createDevAuth(env.devToken);
    if (dev.configured) return dev;
  }
  if (env.supabaseUrl && env.supabaseAnonKey) return createSupabaseAuth({ url: env.supabaseUrl, anonKey: env.supabaseAnonKey });
  return createUnconfiguredAuth();
}

let current: AuthProvider | null = null;
export const getAuth = (): AuthProvider => (current ??= createDefaultAuth());
export function setAuth(p: AuthProvider | null): void {
  current = p;
}
export { describeSignIn } from './describe';
