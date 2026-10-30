# CasaFit · app

React Native (Expo Dev Client) with TypeScript.

See `docs/tech-stack.md` §1, `docs/architecture.md` §2 and `docs/plans/onboarding.md` for context.

## Dev

```bash
pnpm install
pnpm --filter @casafit/app start
```

The first `pnpm install` prebuilds Android/iOS folders. On a mid-range Pixel this takes a few minutes.

## Layout

- `App.tsx` — stack navigator; auth-aware initial route.
- `src/theme/` — tokens mirrored from the design screens, Paper themes.
- `src/state/` — Zustand stores (auth is the first one).
- `src/api/` — fetch client and TanStack Query hooks per module.
- `src/screens/` — one file per screen, named after the matching `project/m3-*.dc.html` file.

## Sign-in (Supabase Auth)

Identity is Supabase Auth: an emailed 6-digit code, plus Google, Apple (iOS) and Facebook through the system browser (PKCE).
The app sends the Supabase access token to the API as `Authorization: Bearer`; the first authenticated request creates the account.
Code is in `src/services/auth/` (port `AuthProvider`, real, dev, fake and "not set up" implementations).

Keys go in `app/.env.local` (see `.env.example`); Expo inlines `EXPO_PUBLIC_*` at build time:

| Key | Meaning |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL, for example `https://abcd.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The project's anon (publishable) key |
| `EXPO_PUBLIC_DEV_AUTH_TOKEN` | Development builds only. A token from `api/tools/mint-dev-token.mjs`; skips Supabase entirely |
| `EXPO_PUBLIC_API_BASE_URL` | API base URL (default `http://localhost:5080`) |

Supabase dashboard: enable Email (OTP, 6 digits) and the Google, Apple and Facebook providers, and add `casafit://auth-callback`
to Authentication, URL configuration, Redirect URLs. With none of the keys set, the sign-in screen says "Sign in is not set up on this build".

### Local API without a Supabase project

```bash
docker compose -f api/docker-compose.yml up --build          # API on :5080, HS256 secret from the compose file
node api/tools/mint-dev-token.mjs                            # prints a 7-day token for dev@casafit.test
# put it in app/.env.local:  EXPO_PUBLIC_DEV_AUTH_TOKEN=<token>
```

The script uses the compose `Supabase__JwtSecret` and `Supabase__Url` by default; if you changed them, pass `--secret` and `--url`
(the issuer is `<url>/auth/v1`). The dev token is ignored in release builds, and the app never calls Supabase when it is used.
After "Sign out" the sign-in screen offers "Continue as the local dev user".
