// The sign-in port. Screens, the API client and the auth store depend on this, never on Supabase directly.
// Implementations: supabase.ts (real), dev.ts (local API with a minted token), fake.ts (tests), none.ts (not set up).

export type SocialProvider = 'google' | 'apple' | 'facebook';
export type SignInMethod = 'email' | SocialProvider;

export interface AuthSession {
  /** Supabase user id (the `sub` claim). */
  userId: string;
  email: string | null;
  method: SignInMethod | 'dev';
  /** Access token expiry, epoch ms. */
  expiresAt: number;
}

export type SendCodeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_email' | 'rate_limited' | 'offline' | 'unavailable' | 'error'; retryAfterS?: number };

export type VerifyCodeResult =
  | { ok: true; session: AuthSession }
  /** Supabase answers one error for a wrong and an expired code; `expired` is used when the implementation can tell. */
  | { ok: false; reason: 'wrong' | 'expired' | 'rate_limited' | 'offline' | 'unavailable' | 'error' };

export type OAuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: 'cancelled' | 'offline' | 'unavailable' | 'error' };

export type RefreshResult =
  | { ok: true; session: AuthSession }
  /** `offline` keeps the person signed in; `rejected` means the refresh token is no longer valid. */
  | { ok: false; reason: 'offline' | 'rejected' | 'none' };

export interface AuthProvider {
  readonly kind: 'supabase' | 'dev' | 'fake' | 'none';
  /** False when this build has no keys and no dev token: the sign-in screens show a calm "not set up" state. */
  readonly configured: boolean;

  /** Email one-time code: send, then verify. Creates the Supabase user on first use. */
  sendEmailCode(email: string): Promise<SendCodeResult>;
  verifyEmailCode(email: string, code: string): Promise<VerifyCodeResult>;
  signInWithOAuth(provider: SocialProvider): Promise<OAuthResult>;
  /** Dev provider only: sign in with the minted token after a sign out. */
  signInAsDev?(): Promise<OAuthResult>;

  /** The stored session, read without the network. Null when signed out. */
  getSession(): Promise<AuthSession | null>;
  /** A usable access token, refreshed when it is about to expire. Null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Force one refresh, used after the API answered 401. */
  refresh(): Promise<RefreshResult>;
  /** Fires on sign in, token refresh and sign out. Returns the unsubscribe function. */
  onChange(listener: (session: AuthSession | null) => void): () => void;
  signOut(): Promise<void>;
}

export const EMAIL_CODE_LENGTH = 6;
/** Supabase sends at most one email a minute to the same address. */
export const RESEND_COOLDOWN_S = 60;
/** The redirect Supabase sends the browser back to after Google, Apple or Facebook. Add it to the project's redirect URLs. */
export const OAUTH_REDIRECT = 'casafit://auth-callback';
