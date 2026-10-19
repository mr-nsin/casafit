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
