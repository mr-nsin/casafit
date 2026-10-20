# CasaFit · Architecture

This is a proposed architecture for the first release. Nothing is built yet. The guiding principle is **"on the phone unless there is a reason not to"**: it saves cost, keeps the app offline-first, and reduces regulated-data exposure.

## 1 · Boundaries

```
   ┌────────────────────────────────────────────────────┐
   │                    Mobile client                   │
   │  React Native 0.76 + Expo Dev Client + TypeScript  │
   │  Plan engine · Session player · Pose runner        │
   │  Local database (Op-SQLite + Drizzle ORM)          │
   └───────────────┬──────────────────────┬─────────────┘
                   │ HTTPS (OTP, sync)    │ store billing
                   │                      │
   ┌───────────────▼───────────────┐  ┌───▼──────────────┐
   │   Backend services (cloud)    │  │  App stores      │
   │   • Auth and OTP              │  │  • Google Play   │
   │   • Account and entitlements  │  │  • App Store     │
   │   • Content delivery          │  └──────────────────┘
   │   • Analytics intake          │
   └───────────────┬───────────────┘
                   │
    ┌──────────────┼──────────────────────────────────┐
    │              │                                  │
    ▼              ▼                                  ▼
  SMS vendor    Supabase Pro Postgres (Mumbai) +    Push and crash
  (DLT-reg.)    Cloudflare R2 + Cloudflare CDN      (FCM / APNs)
                Upstash Redis (serverless)
```

Everything else runs on the phone: the session player, the plan builder, the pose analyser, the step counter and the food lookup.

## 2 · Client (phone)

### 2.1 Platform

- **React Native 0.76+** with the New Architecture (Fabric + TurboModules).
- **Expo SDK 52+ with a Dev Client** (not the managed workflow). Keeps Expo's ergonomics while allowing the native modules we need for pose, attestation and billing.
- **TypeScript 5**, `strict: true`. One language with the backend.
- **Material 3 look** matched by `react-native-paper` plus tokens exported from the design pack.
- **Android min SDK 26**, **iOS 16+**.

### 2.2 On-device modules

Each is a package under `app/src/modules/`.

| Module | Responsibility |
|---|---|
| **Plan engine** | Builds the week-one plan from onboarding answers using rules. See `decisions.md` for the "rules not AI" decision. |
| **Content catalogue** | Downloaded videos, demos, muscle tags and the substitution ladder, bundled or pulled on Wi-Fi. |
| **Session player** | Timer, voice coach, rest and skip controls, offline. |
| **Pose runner** | `react-native-vision-camera` + a MediaPipe Pose Tasks frame-processor plugin. On-device on both platforms. Runs only on the four analysed exercises. |
| **Step counter** | `expo-sensors` Pedometer, with `react-native-health-connect` as the Android fallback. Reads the phone's step sensor or Health Connect / HealthKit. No GPS. |
| **Food database** | Op-SQLite copy of the Indian food catalogue plus the user's log. |
| **Local store** | Encrypted at rest. Health answers never leave the phone unless the user turns on sync in Privacy. |
| **Entitlements cache** | Caches the free-check balance and Pro state. Spends offline against the cache; reconciles with the server on reconnect. |

### 2.3 Offline first

The user verifies once online, then the app downloads week one. After that:

- All sessions, timers, cues and plans work offline.
- Food search works offline against the bundled catalogue.
- Step counts update offline from the phone's sensor.
- The server is contacted only for: verifying a new sign-in, syncing the free-check balance, downloading new content and store receipts.

The phone keeps a cached session token with a grace period (7 days by default). Pro status is cached too, so a cancelled or lapsed network does not pull Pro features in the middle of a workout.

## 3 · Backend services

**One NestJS 10 service on Node.js 20**, six `@Module`s inside it. One Dockerfile, one deploy. Stateless, horizontally scalable behind an application load balancer. Split a module into its own service only when traffic justifies. **Open question (defer):** host on AWS App Runner, GCP Cloud Run, or Azure Container Apps — all Mumbai; see `decisions.md`.

### 3.1 Auth service

- **Purpose:** issue and verify 6-digit codes, mint session tokens, handle "Continue with Google."
- **Store:** short-lived codes in Redis, accounts in Postgres.
- **Abuse controls:** per-number, per-device and per-IP send limits; attestation (Play Integrity on Android, App Attest on iOS) checked before any code is sent.
- **DLT compliance:** SMS templates and sender header registered on the operator portals before launch.

### 3.2 Account service

- **Purpose:** profile, plan metadata, nutrition profile, settings, consent records.
- **Store:** Postgres. One row per account, foreign-keyed child tables.
- **Health answers:** stored only when the user turns on sync; encrypted column-level with a per-account key.

### 3.3 Entitlements module

Holds the number that matters most for billing: a free account's lifetime form-check balance.

- **Rule:** 2 credits per account, for the life of the account. No daily reset. No reset on reinstall.
- **Enforcement:** the server is the source of truth. The phone caches the balance, and reconciles when online. See `data-model.md` for the credit record and offline-spend rules.
- **Idempotency:** every `/entitlements/consume` and `/entitlements/refund` carries a client-generated key. A unique index on `(account_id, kind, idempotency_key)` makes retries safe.
- **Pro:** RevenueCat is the integration surface. It posts webhooks on sign-up, renewal and cancellation; the backend cross-checks with Google Play Developer API and App Store Server API. The phone caches Pro state for a day. |

### 3.4 Content delivery

- **Videos and demos:** uploaded to Cloudflare R2 with Cloudflare CDN in front. Signed URLs for premium content. R2's zero egress keeps CDN cost flat as video traffic grows; see `decisions.md`.
- **Food database:** published as a versioned JSON pack, downloaded on Wi-Fi and merged into the local SQLite.

### 3.5 Analytics intake

- **Rule:** no health values, no body measurements, no free text. Just event names, counts, and anonymous device IDs.
- **Store:** a managed analytics product (PostHog self-hosted or a hosted equivalent). See `tech-stack.md`.

### 3.6 Push notifications

- **Android:** FCM. **iOS:** APNs. One daily reminder maximum, time chosen by the user. No "you missed yesterday" messages.

## 4 · Data flow for the main loops

### 4.1 First-run flow

1. User enters a phone number. The client calls `POST /auth/code`. The server runs attestation and send-limit checks, then asks the SMS vendor to send the OTP template.
2. User enters the code. `POST /auth/verify` returns a session token and a new account row.
3. The client runs the two onboarding screens locally and the plan engine builds week one on the phone.
4. The plan metadata is `PUT /me/plan` to the account service. The screens stay on the phone until the user opens them.

### 4.2 Form check (free account)

1. The player taps Check form. The client calls `POST /entitlements/consume` with a client-generated idempotency key.
2. The server checks the balance; if positive, it decrements and returns `ok: true`. The idempotency key stops a repeat on retry.
3. The phone starts the pose runner. Nothing leaves the device.
4. If the run ends before 3 reps, the client calls `POST /entitlements/refund` with the same key.

### 4.3 Pro form check

Same as above, but with no `consume` call. The entitlement service exposes `GET /me/entitlements` to say "pro: true, until: 2027-10-14."

### 4.4 Food log

Pure local write. Synced to the server once a day for backup, in a batch, so the phone works without a connection.

## 5 · Privacy and data residency

- **Rule from the PRD:** DPDP Act applies at launch. Health answers are special-category data, biometric-adjacent processing stays on the device.
- **Residency:** Indian user data stored in `asia-south1` or `ap-south-1`. Cross-border transfers only to a push vendor if we cannot avoid them, and we try.
- **Camera frames:** processed in memory only. The pose runner writes no file. The release build turns off the ability to record to disk.
- **Delete my account:** removes the account row, logs and the free-check balance. See `data-model.md` for the loophole decision (keep a salted hash of the identifier for a stated period).

## 6 · Non-functional targets

| Area | Target |
|---|---|
| Cold start, mid-range Android | Under 2 seconds |
| Session start, downloaded session | No network call |
| Offline grace period for session, after verification | 7 days |
| Code arrival from `POST /auth/code` | 90% within 30 seconds, per carrier |
| Battery, 15-minute camera session | Under 6% on a Pixel-class device |
| Accessibility | Larger text, high contrast, audio-first player, visible focus everywhere |

Targets are starting hypotheses; refine from the first beta.

## 7 · What this architecture is not

- No microservices-per-feature. One NestJS service with six modules is enough until there is traffic to split.
- No bespoke video player. `react-native-video` wraps the platform players.
- No bespoke pose model. MediaPipe Pose Tasks on both platforms until there is evidence it is not enough.
- No server-side computer vision in v1. See the "camera stays on the phone" decision in `decisions.md`.
- No ML pipeline for food recognition in v1. v2 adds a third-party vision API behind a confirm-and-correct UI.
- No GraphQL, no gRPC. REST + JSON at `/v1/`, versioned.

## 8 · Where to go next

- Picking the actual frameworks and versions: `tech-stack.md`.
- Data model, keys, retention: `data-model.md`.
- The vocabulary: `glossary.md`.
- Record a change: `decisions.md`.
