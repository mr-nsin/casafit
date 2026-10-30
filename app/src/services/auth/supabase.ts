// The real sign-in: Supabase Auth over supabase-js. Email one-time code and Google / Apple / Facebook through the
// system browser (PKCE). The session lives in expo-secure-store via the chunked adapter, and supabase-js refreshes it.
//
// supabase-js is used for Auth only. URL parsing is done by hand because React Native's URL has no working
// searchParams; `detectSessionInUrl` is off for the same reason.

import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { createChunkedStorage, type AuthStorage } from './secureStorage';
import {
  OAUTH_REDIRECT,
  type AuthProvider,
  type AuthSession,
  type OAuthResult,
  type RefreshResult,
  type SendCodeResult,
  type SignInMethod,
  type SocialProvider,
  type VerifyCodeResult,
} from './types';

export const STORAGE_KEY = 'casafit.auth';

export interface AppStateLike {
  currentState: string;
  addEventListener(type: 'change', fn: (state: string) => void): { remove(): void };
}

export interface SupabaseAuthOptions {
  url: string;
  anonKey: string;
  storage?: AuthStorage;
  /** Tests inject a fake client. */
  client?: SupabaseClient;
  /** Opens the system browser and resolves with the URL it came back to. Defaults to expo-web-browser. */
  openAuthSession?: (url: string, redirectTo: string) => Promise<{ type: 'success'; url: string } | { type: 'cancel' }>;
  /** Pause token refresh in the background (React Native advice from Supabase). Pass null to skip. */
  appState?: AppStateLike | null;
}

type AuthErrorLike = { name?: string; code?: string; status?: number; message?: string } | null | undefined;

const isOffline = (e: AuthErrorLike): boolean =>
  !!e && (e.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(e.message ?? ''));
const isRateLimited = (e: AuthErrorLike): boolean =>
  !!e && (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit');

export function mapSession(s: Session): AuthSession {
  const provider = (s.user.app_metadata?.provider as string | undefined) ?? 'email';
  const method: SignInMethod = provider === 'google' || provider === 'apple' || provider === 'facebook' ? provider : 'email';
  return {
    userId: s.user.id,
    email: s.user.email?.toLowerCase() ?? null,
    method,
    expiresAt: (s.expires_at ?? 0) * 1000,
  };
}

/** Reads `code`, `error` and `error_description` from the query or the fragment of a redirect URL. */
export function parseCallback(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const [beforeHash = '', hash = ''] = url.split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  for (const part of [query, hash]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const k = decodeURIComponent((eq < 0 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
      out[k] = eq < 0 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    }
  }
  return out;
}

async function defaultOpenAuthSession(url: string, redirectTo: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  const r = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  return r.type === 'success' ? ({ type: 'success', url: r.url } as const) : ({ type: 'cancel' } as const);
}

function defaultAppState(): AppStateLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native') as { AppState: AppStateLike }).AppState;
  } catch {
    return null;
  }
}

function makeClient(url: string, anonKey: string, storage: AuthStorage): SupabaseClient {
  // Loaded on demand so that code which only needs the port never pulls supabase-js in.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return createClient(url, anonKey, {
    auth: {
      storage,
      storageKey: STORAGE_KEY,
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAuth(opts: SupabaseAuthOptions): AuthProvider {
  const storage = opts.storage ?? createChunkedStorage();
  const client = opts.client ?? makeClient(opts.url, opts.anonKey, storage);
  const openAuthSession = opts.openAuthSession ?? defaultOpenAuthSession;

  const appState = opts.appState === undefined ? defaultAppState() : opts.appState;
  if (appState) {
    const apply = (s: string) => void (s === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh());
    apply(appState.currentState);
    appState.addEventListener('change', apply);
  }

  /** The session as stored, without refreshing. Lets a cold start with no network stay signed in. */
  async function storedSession(): Promise<Session | null> {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s?.access_token && s.user?.id ? s : null;
    } catch {
      return null;
    }
  }

  async function finishOAuth(redirected: string): Promise<OAuthResult> {
    const p = parseCallback(redirected);
    if (p.error) return { ok: false, reason: p.error === 'access_denied' ? 'cancelled' : 'error' };
    if (!p.code) return { ok: false, reason: 'error' };
    const { data, error } = await client.auth.exchangeCodeForSession(p.code);
    if (error || !data.session) return { ok: false, reason: isOffline(error) ? 'offline' : 'error' };
    return { ok: true, session: mapSession(data.session) };
  }

  return {
    kind: 'supabase',
    configured: true,

    async sendEmailCode(email): Promise<SendCodeResult> {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (!error) return { ok: true };
      if (isOffline(error)) return { ok: false, reason: 'offline' };
      if (isRateLimited(error)) return { ok: false, reason: 'rate_limited', retryAfterS: 60 };
      if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return { ok: false, reason: 'invalid_email' };
      if (error.code === 'email_provider_disabled' || error.code === 'otp_disabled' || error.code === 'signup_disabled') {
        return { ok: false, reason: 'unavailable' };
      }
      return { ok: false, reason: 'error' };
    },

    async verifyEmailCode(email, code): Promise<VerifyCodeResult> {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (!error && data.session) return { ok: true, session: mapSession(data.session) };
      if (isOffline(error)) return { ok: false, reason: 'offline' };
      if (isRateLimited(error)) return { ok: false, reason: 'rate_limited' };
      // Supabase uses `otp_expired` for both a wrong and an expired code, so the screen decides by elapsed time.
      if (error?.code === 'otp_expired' || error?.code === 'validation_failed' || error?.status === 403 || error?.status === 422) {
        return { ok: false, reason: 'wrong' };
      }
      return { ok: false, reason: 'error' };
    },

    async signInWithOAuth(provider: SocialProvider): Promise<OAuthResult> {
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) return { ok: false, reason: isOffline(error) ? 'offline' : 'error' };
      let result: Awaited<ReturnType<typeof openAuthSession>>;
      try {
        result = await openAuthSession(data.url, OAUTH_REDIRECT);
      } catch {
        return { ok: false, reason: 'error' };
      }
      if (result.type !== 'success') return { ok: false, reason: 'cancelled' };
      return finishOAuth(result.url);
    },

    async getSession() {
      const s = await storedSession();
      return s ? mapSession(s) : null;
    },

    async getAccessToken() {
      const { data, error } = await client.auth.getSession();
      if (data.session) return data.session.access_token;
      if (error && isOffline(error)) return (await storedSession())?.access_token ?? null;
      return null;
    },

    async refresh(): Promise<RefreshResult> {
      const { data, error } = await client.auth.refreshSession();
      if (data.session) return { ok: true, session: mapSession(data.session) };
      if (isOffline(error)) return { ok: false, reason: 'offline' };
      if (error?.name === 'AuthSessionMissingError') return { ok: false, reason: 'none' };
      return { ok: false, reason: 'rejected' };
    },

    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') listener(null);
        else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) listener(mapSession(session));
      });
      return () => data.subscription.unsubscribe();
    },

    async signOut() {
      // Local scope: signing out must work with no network. The refresh token expires on its own.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await storage.removeItem(STORAGE_KEY).catch(() => undefined);
    },
  };
}
