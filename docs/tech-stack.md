# CasaFit · Tech stack

Chosen technologies for the first release. Pricing is at list prices as of October 2026 and is a planning estimate, not a quote.

## 0 · What changed (19 October 2026)

The native plan (Kotlin + Compose on Android, Swift + SwiftUI on iOS, Kotlin + Ktor on the backend) was replaced with:

- **Mobile:** React Native with Expo Dev Client, TypeScript.
- **Backend:** NestJS on Node.js 20, TypeScript.

See `decisions.md` for why.

## 1 · Mobile (React Native)

### 1.1 Core

| Layer | Choice | Why |
|---|---|---|
| Framework | React Native 0.76 or later, New Architecture (Fabric + TurboModules) | Current, better performance for the session player's timer and animations. |
| Managed layer | Expo SDK 52+ with a Dev Client (not the managed workflow) | Keeps Expo's ergonomics while allowing the native modules we need for pose, attestation and billing. |
| Language | TypeScript 5, `strict: true` | One language with the backend. Fewer bugs. |
| Package manager | pnpm | Fast, deterministic installs. |

### 1.2 UI and navigation

| Layer | Choice | Why |
|---|---|---|
| UI kit | react-native-paper 5, Material 3 | Matches our design screens. Theming via tokens. |
| Styling | StyleSheet.create + a tokens module exported from the design pack | Keeps colours and spacing in one place; mirrors the CSS variables in the `.dc.html` screens. |
| Navigation | @react-navigation/native 7 + native-stack and bottom-tabs | Standard, well-maintained. |
| Icons | @expo/vector-icons (Material Symbols subset) | Only the icons used on the screens are bundled. |
| Fonts | @expo-google-fonts/roboto-flex, @expo-google-fonts/noto-sans-devanagari | Covers English and Hindi. Tamil, Telugu, Bengali added when those launch. |

### 1.3 State and data

| Layer | Choice | Why |
|---|---|---|
| Client state | Zustand 5 | Small, no boilerplate, easy to test. |
| Server state | TanStack Query 5 | Cache, retry, offline-friendly. |
| Local DB | Op-SQLite + Drizzle ORM | Fast on the New Architecture. Type-safe migrations. Lighter than WatermelonDB for a database of this size. |
| Secure storage | expo-secure-store | Session tokens and the lifetime free-check balance cache. |
| Offline queue | Hand-rolled, backed by Op-SQLite | Sessions, food and steps queue, flushed on reconnect. |

### 1.4 Platform integrations

| Capability | Choice | Why |
|---|---|---|
| Camera and pose | react-native-vision-camera 4 + a MediaPipe Pose Tasks frame-processor plugin | Runs on-device, both platforms. iOS parity needs a one-week spike (see risks). |
| Step counter | expo-sensors (`Pedometer`) + react-native-health-connect (Android fallback) | Phone sensor on both platforms. No GPS. |
| Billing | RevenueCat SDK | Cross-platform entitlements, server-side receipt validation, store events. Saves weeks over writing against StoreKit 2 and Play Billing directly. |
| Attestation | react-native-google-play-integrity (Android), a thin Expo module around App Attest (iOS) | One of the signals that gate OTP sends. |
| Push | @react-native-firebase/messaging (Android), native APNs via Expo (iOS) | Vendor-neutral. |
| Analytics | posthog-react-native | Self-hostable in Mumbai for residency. No health values. |
| i18n | i18next + react-i18next | Devanagari and other Indic scripts load from Google Fonts. |

### 1.5 Dev tooling

| Area | Choice |
|---|---|
| Build | EAS Build (Expo's cloud build), both platforms |
| Preview distribution | EAS Update + TestFlight / Play Internal Testing |
| Lint and format | ESLint, Prettier, TypeScript strict mode |
| Unit tests | Jest + @testing-library/react-native |
| End-to-end tests | Maestro (simpler than Detox, YAML flows the QA agent can read) |
| Error reporting | Sentry (same org as the backend) |

### 1.6 Not using

- **Flutter, native Android or iOS.** We traded native performance for one codebase, one team, and faster shipping. The pose runner is the only piece that may still need native modules.
- **Expo managed workflow.** We need custom native modules.
- **Redux Toolkit.** Zustand plus TanStack Query covers both state kinds.
- **WatermelonDB.** Op-SQLite + Drizzle is enough.

## 2 · Backend (NestJS)

### 2.1 Core

| Layer | Choice | Why |
|---|---|---|
| Framework | NestJS 10 or later | Opinionated, modular, strong DI, OpenAPI generation. Same language as the app. |
| Runtime | Node.js 20 LTS | Supported until April 2026. Move to 22 LTS when the next window opens. |
| Language | TypeScript 5, `strict: true`, `noUncheckedIndexedAccess: true` | |
| Package manager | pnpm | |
| API | REST + JSON at `/v1/`, OpenAPI via @nestjs/swagger | Simple, versioned, cacheable. |
| Validation | class-validator + class-transformer + ValidationPipe | NestJS standard. |

### 2.2 Modules

Each is one `@Module` in the Nest sense; one package in `src/modules/`.

| Module | Purpose |
|---|---|
| `auth` | OTP send and verify, JWT issue, refresh tokens, Google sign-in. |
| `accounts` | Profile, plan metadata, consent records. |
| `entitlements` | The lifetime free-check balance. Receives RevenueCat webhooks for Pro. |
| `content` | Signed URLs for videos and the food pack. |
| `analytics` | Thin passthrough to PostHog. No health values. |
| `admin` | Internal endpoints behind a separate guard. |

### 2.3 Data

| Layer | Choice | Why |
|---|---|---|
| ORM | Prisma 5 | Type-safe migrations, matches the TypeScript theme. |
| Database | Postgres 16 (AWS RDS or Google Cloud SQL, Mumbai) | India residency. |
| Cache | Redis 7 (managed, Mumbai) | OTP codes, rate counters, idempotency keys. |
| Queue | BullMQ on Redis | Daily food and step syncs, batched analytics flushes. |
| Object storage | S3 or GCS, Mumbai | Videos, food packs, data exports. |
| CDN | CloudFront or Cloud CDN | For video and the food pack. |

### 2.4 Platform integrations

| Capability | Choice | Why |
|---|---|---|
| SMS (India) | A DLT-registered aggregator (MSG91 or Gupshup) over HTTP | Required for Indian OTP delivery. |
| Email | Resend or AWS SES | Email verification, support replies. |
| Store receipt validation | Google Play Developer API, App Store Server API, cross-checked with the RevenueCat webhook | Belt and braces for Pro state. |
| Attestation checks | Google Play Integrity decryption, App Attest validation | Verified before any OTP send. |
| Observability | OpenTelemetry SDK → Grafana Cloud (Loki, Prometheus, Tempo) | One stack across logs, metrics and traces. |
| Error reporting | Sentry | Same org as the app. |

### 2.5 API surface, in one glance

```
POST   /v1/auth/code              send an OTP
POST   /v1/auth/verify            verify and get tokens
POST   /v1/auth/refresh           refresh the access token
GET    /v1/me                     account summary
PUT    /v1/me/plan                upsert plan metadata
GET    /v1/me/entitlements        pro and free-check status
POST   /v1/entitlements/consume   spend one free check (idempotent)
POST   /v1/entitlements/refund    give one free check back (idempotent)
POST   /v1/webhooks/revenuecat    Pro state updates
GET    /v1/content/pack/latest    the current food pack version
```

### 2.6 Dev tooling

| Area | Choice |
|---|---|
| Tests | Jest (unit, built into NestJS) + Supertest (e2e against a Testcontainers Postgres) |
| Container | Dockerfile targeting `node:20-alpine` |
| Deploy | AWS ECS Fargate (Mumbai) **or** GCP Cloud Run (Mumbai). Pick one before the first commit. |
| CI | GitHub Actions matrix: unit, e2e, build and push the image |
| Secrets | AWS Secrets Manager or GCP Secret Manager |

### 2.7 Not using

- **FastAPI, Ktor.** Dropped by the switch to TypeScript everywhere.
- **GraphQL.** The surface is small and change-light. Not worth the extra complexity.
- **gRPC.** Same.
- **Microservices per feature.** One Nest service, six modules, scales horizontally.

## 3 · Shared across the stack

| Area | Choice |
|---|---|
| Source | GitHub `mr-nsin/casafit` |
| CI | GitHub Actions |
| Project tooling | pnpm workspaces, three packages: `app/` (React Native), `api/` (NestJS), `shared/` (TypeScript types and zod schemas for request bodies) |
| Shared types | Generated from Prisma for DB types; hand-written zod schemas for request and response shapes |
| Monitoring | OpenTelemetry across both runtimes, into Grafana Cloud |

Keeping React Native and NestJS in one monorepo means `shared/` holds the DTOs both sides agree on, with the compiler enforcing it.

## 4 · Cost shape

Order-of-magnitude only. All numbers are "roughly" and would be re-quoted before the first user.

| Line | Shape |
|---|---|
| Mumbai managed Postgres (small) | $60 to $150 a month |
| Redis (small, managed) | $30 to $80 a month |
| Fargate or Cloud Run (one small task) | $40 to $120 a month |
| Object storage + CDN (one 50 MB session pack per active user per month) | A few cents per active user per month |
| SMS OTP (India) | Roughly ₹0.15 to ₹0.30 per message. Belongs in LTV calculations. |
| RevenueCat | Free up to $10k MTR, then 1% of revenue. |
| EAS Build | Metered by build minutes; one or two paid plans typical for a small team. |
| Sentry, PostHog | Free tiers until usage. |

**Per-user AI inference** is zero in v1 because pose runs on the phone. v2 photo food recognition adds roughly $0.0006 per image at the cheap end (see §12 of the PRD).

## 5 · Known risks

- **Pose on iOS, React Native.** The MediaPipe Pose Tasks frame-processor plugin for VisionCamera is more mature on Android. Verify iOS during a one-week spike before committing. Fallback: a thin native Vision wrapper exposed as an Expo module.
- **New Architecture gotchas.** Some popular libraries lag Fabric or TurboModules. Audit the dependency list before the first native build.
- **Store policy drift.** Apple's "biometric-adjacent processing" and "server-side analysis" rules have moved before. Re-check both store policies at submission time.
- **DPDP timing.** The Rules apply in full around 13 May 2027. A launch after that date needs the privacy notice reviewed by counsel.
- **SMS pumping.** Any open OTP endpoint can be abused. Attestation and send-limits are mandatory, not optional.

## 6 · Pinned versions

Until the first commit, "N or later" is enough. On the first commit, pin exact versions and update `decisions.md`.
