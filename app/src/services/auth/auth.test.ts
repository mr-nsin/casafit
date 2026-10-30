import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { createDefaultAuth, createDevAuth, createSupabaseAuth, decodeDevToken, parseCallback } from './index';
import { OAUTH_REDIRECT } from './types';
import { CHUNK_SIZE, createChunkedStorage, type KeyValueStore } from './secureStorage';

const memStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => void data.set(k, v),
    deleteItemAsync: async (k) => void data.delete(k),
  };
};

describe('chunked secure storage', () => {
  it('stores a small value in one piece', async () => {
    const store = memStore();
    const s = createChunkedStorage(store);
    await s.setItem('sb:key', 'hello');
    expect([...store.data.keys()]).toEqual(['sb_key']);
    expect(await s.getItem('sb:key')).toBe('hello');
  });

  it('splits a large session into chunks under the 2 KB limit and reads it back', async () => {
    const store = memStore();
    const s = createChunkedStorage(store);
    const big = JSON.stringify({ access_token: 'x'.repeat(5000), refresh_token: 'r' });
    await s.setItem('casafit.auth', big);
    expect(store.data.size).toBeGreaterThan(2);
    for (const v of store.data.values()) expect(v.length).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(await s.getItem('casafit.auth')).toBe(big);
  });

  it('removes stale chunks when a value shrinks, and on remove', async () => {
    const store = memStore();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'y'.repeat(4000));
    await s.setItem('k', 'short');
    expect([...store.data.keys()]).toEqual(['k']);
    await s.setItem('k', 'y'.repeat(4000));
    await s.removeItem('k');
    expect(store.data.size).toBe(0);
  });

  it('reads a torn write as signed out', async () => {
    const store = memStore();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'y'.repeat(4000));
    store.data.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await createChunkedStorage(memStore()).getItem('nope')).toBeNull();
  });
});

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (claims: object) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;

describe('dev provider', () => {
  const claims = { sub: 'dev-1', email: 'Dev@Casafit.test', exp: 2_000_000_000 };

  it('decodes the minted token without any network', async () => {
    expect(decodeDevToken(jwt(claims))).toEqual({ userId: 'dev-1', email: 'dev@casafit.test', method: 'dev', expiresAt: 2_000_000_000_000 });
    expect(decodeDevToken('garbage')).toBeNull();
  });

  it('is signed in at once, hands out the token, and can sign back in after a sign out', async () => {
    const token = jwt(claims);
    const dev = createDevAuth(token, () => 1_000);
    const seen: unknown[] = [];
    dev.onChange((s) => seen.push(s?.userId ?? null));
    expect(await dev.getAccessToken()).toBe(token);
    await dev.signOut();
    expect(await dev.getSession()).toBeNull();
    expect(await dev.signInAsDev?.()).toMatchObject({ ok: true });
    expect(await dev.getAccessToken()).toBe(token);
    expect(seen).toEqual([null, 'dev-1']);
  });

  it('treats an expired token as signed out', async () => {
    const dev = createDevAuth(jwt({ ...claims, exp: 10 }), () => 20_000);
    expect(await dev.getSession()).toBeNull();
  });
});

describe('provider choice', () => {
  it('uses the dev token in development builds only', () => {
    const t = jwt({ sub: 's', exp: 2_000_000_000 });
    expect(createDefaultAuth({ dev: true, devToken: t }).kind).toBe('dev');
    expect(createDefaultAuth({ dev: false, devToken: t }).kind).toBe('none');
  });

  it('uses Supabase when both keys are set', () => {
    // appState null: no AppState listener in Jest. The real client is created here, which also checks that supabase-js loads.
    const a = createSupabaseAuth({ url: 'https://abc.supabase.co', anonKey: 'anon', storage: createChunkedStorage(memStore()), appState: null });
    expect(a.kind).toBe('supabase');
    expect(createDefaultAuth({ dev: false, supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'k' }).kind).toBe('supabase');
  });

  it('is calmly "none" with neither, and every call answers unavailable', async () => {
    const a = createDefaultAuth({ dev: true });
    expect(a.configured).toBe(false);
    expect(await a.sendEmailCode('a@b.co')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await a.getAccessToken()).toBeNull();
  });
});

describe('parseCallback', () => {
  it('reads the code from the query and errors from the fragment', () => {
    expect(parseCallback(`${OAUTH_REDIRECT}?code=abc%20d&x=1`)).toMatchObject({ code: 'abc d', x: '1' });
    expect(parseCallback(`${OAUTH_REDIRECT}#error=access_denied&error_description=No+thanks`)).toMatchObject({
      error: 'access_denied',
      error_description: 'No thanks',
    });
  });
});

// A scripted supabase-js client: the real one needs a project, so this checks our mapping around it.
function fakeClient(over: Record<string, unknown> = {}) {
  const session = {
    access_token: 'tok',
    refresh_token: 'ref',
    expires_at: 2_000_000_000,
    user: { id: 'u1', email: 'Asha@Example.com', app_metadata: { provider: 'google' } },
  } as unknown as Session;
  const auth = {
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ data: { session }, error: null })),
    signInWithOAuth: jest.fn(async () => ({ data: { url: 'https://abc.supabase.co/auth/v1/authorize?provider=google' }, error: null })),
    exchangeCodeForSession: jest.fn(async () => ({ data: { session }, error: null })),
    getSession: jest.fn(async () => ({ data: { session }, error: null })),
    refreshSession: jest.fn(async () => ({ data: { session }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
    ...over,
  };
  return { client: { auth } as unknown as SupabaseClient, auth, session };
}

const make = (client: SupabaseClient, extra: Partial<Parameters<typeof createSupabaseAuth>[0]> = {}) =>
  createSupabaseAuth({ url: 'u', anonKey: 'k', client, storage: createChunkedStorage(memStore()), appState: null, ...extra });

describe('supabase provider', () => {
  it('sends the code and creates the user on first use', async () => {
    const { client, auth } = fakeClient();
    expect(await make(client).sendEmailCode('asha@example.com')).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'asha@example.com', options: { shouldCreateUser: true } });
  });

  it('maps send errors', async () => {
    const run = async (error: object) => {
      const { client } = fakeClient({ signInWithOtp: jest.fn(async () => ({ error })) });
      return make(client).sendEmailCode('a@b.co');
    };
    expect(await run({ name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit' })).toEqual({ ok: false, reason: 'rate_limited', retryAfterS: 60 });
    expect(await run({ name: 'AuthRetryableFetchError', status: 0 })).toEqual({ ok: false, reason: 'offline' });
    expect(await run({ status: 400, code: 'email_address_invalid' })).toEqual({ ok: false, reason: 'invalid_email' });
    expect(await run({ status: 500 })).toEqual({ ok: false, reason: 'error' });
  });

  it('verifies the code and maps the session', async () => {
    const { client, auth } = fakeClient();
    const r = await make(client).verifyEmailCode('asha@example.com', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'asha@example.com', token: '123456', type: 'email' });
    expect(r).toEqual({ ok: true, session: { userId: 'u1', email: 'asha@example.com', method: 'google', expiresAt: 2_000_000_000_000 } });
  });

  it('treats otp_expired as a wrong code (Supabase uses it for both)', async () => {
    const { client } = fakeClient({ verifyOtp: jest.fn(async () => ({ data: { session: null }, error: { status: 403, code: 'otp_expired' } })) });
    expect(await make(client).verifyEmailCode('a@b.co', '000000')).toEqual({ ok: false, reason: 'wrong' });
  });

  it('opens the browser with the app redirect and exchanges the PKCE code', async () => {
    const { client, auth } = fakeClient();
    const open = jest.fn(async () => ({ type: 'success' as const, url: `${OAUTH_REDIRECT}?code=pkce123` }));
    const r = await make(client, { openAuthSession: open }).signInWithOAuth('google');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'casafit://auth-callback', skipBrowserRedirect: true } });
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/authorize'), 'casafit://auth-callback');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce123');
    expect(r.ok).toBe(true);
  });

  it('is cancelled when the browser closes or the person denies access', async () => {
    const { client, auth } = fakeClient();
    expect(await make(client, { openAuthSession: async () => ({ type: 'cancel' }) }).signInWithOAuth('apple')).toEqual({ ok: false, reason: 'cancelled' });
    const denied = await make(client, { openAuthSession: async () => ({ type: 'success', url: `${OAUTH_REDIRECT}#error=access_denied` }) }).signInWithOAuth('facebook');
    expect(denied).toEqual({ ok: false, reason: 'cancelled' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('refreshes: ok, offline stays signed in, rejected means sign out', async () => {
    expect((await make(fakeClient().client).refresh()).ok).toBe(true);
    const offline = fakeClient({ refreshSession: jest.fn(async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError' } })) });
    expect(await make(offline.client).refresh()).toEqual({ ok: false, reason: 'offline' });
    const rejected = fakeClient({ refreshSession: jest.fn(async () => ({ data: { session: null }, error: { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' } })) });
    expect(await make(rejected.client).refresh()).toEqual({ ok: false, reason: 'rejected' });
  });

  it('falls back to the stored token when the network blocks a refresh', async () => {
    const storage = createChunkedStorage(memStore());
    await storage.setItem('casafit.auth', JSON.stringify({ access_token: 'old', refresh_token: 'r', user: { id: 'u1' } }));
    const { client } = fakeClient({ getSession: jest.fn(async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError' } })) });
    const a = make(client, { storage });
    expect(await a.getAccessToken()).toBe('old');
    expect((await a.getSession())?.userId).toBe('u1'); // a cold start with no network stays signed in
  });

  it('passes through sign-out events and signs out locally', async () => {
    let handler: (e: string, s: Session | null) => void = () => undefined;
    const { client, auth, session } = fakeClient({
      onAuthStateChange: jest.fn((h: typeof handler) => {
        handler = h;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    });
    const a = make(client);
    const seen: (string | null)[] = [];
    a.onChange((s) => seen.push(s?.userId ?? null));
    handler('INITIAL_SESSION', null); // ignored: an offline cold start must not look signed out
    handler('TOKEN_REFRESHED', session);
    handler('SIGNED_OUT', null);
    expect(seen).toEqual(['u1', null]);
    await a.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('pauses token refresh in the background', () => {
    const { client, auth } = fakeClient();
    let cb: (s: string) => void = () => undefined;
    make(client, { appState: { currentState: 'active', addEventListener: (_t, fn) => ((cb = fn), { remove() {} }) } });
    expect(auth.startAutoRefresh).toHaveBeenCalled();
    cb('background');
    expect(auth.stopAutoRefresh).toHaveBeenCalled();
  });
});
