# CasaFit · Tech stack

Chosen technologies for the first release. Pricing is at list prices as of October 2026 and is a planning estimate, not a quote.

## 0 · What changed

**26 October 2026.** The backend moved from NestJS on Node.js 20 to **ASP.NET Core on .NET 10 LTS (C#)**. Prisma became EF Core, BullMQ became Hangfire, class-validator became FluentValidation, and Jest/Supertest became xUnit with `WebApplicationFactory`. The mobile choice below is unchanged. See `decisions.md`.

**19 October 2026.** The native plan (Kotlin + Compose on Android, Swift + SwiftUI on iOS, Kotlin + Ktor on the backend) was replaced with:

- **Mobile:** React Native with Expo Dev Client, TypeScript.
- **Backend:** NestJS on Node.js 20, TypeScript (superseded on 26 October).

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

## 2 · Backend (ASP.NET Core)

### 2.1 Core

| Layer | Choice | Why |
|---|---|---|
| Framework | ASP.NET Core Web API (controllers with `[ApiController]`) | Built-in DI, middleware pipeline, JWT bearer auth, rate limiting and OpenAPI. Mature Azure path. |
| Runtime | .NET 10 LTS (supported to November 2028) | .NET 8 LTS leaves support in November 2026, so a new service starts on 10. |
| Language | C# 14, nullable reference types on, warnings as errors | |
| Solution | `api/CasaFit.sln`, Clean Architecture: `CasaFit.Api`, `CasaFit.Application`, `CasaFit.Domain`, `CasaFit.Infrastructure`, plus `CasaFit.UnitTests` and `CasaFit.IntegrationTests` | Domain has no dependencies; Infrastructure is the only project that knows EF Core, Redis and HTTP vendors. |
| Package manager | NuGet, central package management (`Directory.Packages.props`) | One place to pin versions. |
| API | REST + JSON at `/v1/` (Asp.Versioning), OpenAPI via `Microsoft.AspNetCore.OpenApi`, Scalar UI in development | Simple, versioned, cacheable. The OpenAPI document is the contract with the app (see §3). |
| Validation | FluentValidation, run by an endpoint filter on every request DTO | Closest match to the old class-validator rules. |
| Errors | `IExceptionHandler` + RFC 9457 `ProblemDetails` | One error shape for the app to parse. |

### 2.2 Modules

Each module is one feature folder (`Auth/`, `Accounts/`, ...) repeated in `Api` (controllers), `Application` (services, validators) and `Infrastructure` (EF configuration, vendor clients), and registered by one `AddXxxModule()` extension on `IServiceCollection`.

| Module | Purpose |
|---|---|
| `Auth` | OTP send and verify, JWT issue, refresh tokens, Google sign-in. |
| `Accounts` | Profile, plan metadata, consent records. |
| `Entitlements` | The lifetime free-check balance. Receives RevenueCat webhooks for Pro. |
| `Content` | Signed URLs for videos and the food pack. |
| `Analytics` | Thin passthrough to PostHog. No health values. |
| `Admin` | Internal endpoints behind a separate authorization policy. |

### 2.3 Data

| Layer | Choice | Why |
|---|---|---|
| ORM | Entity Framework Core 10 with Npgsql, code-first migrations | Replaces Prisma. LINQ queries, change tracking, migrations checked into `api/`. |
| Database | Postgres 16 on **Supabase Pro, Mumbai (`ap-south-1`)** | India residency, bundles managed Postgres + Supavisor pooling + daily backups; $25/mo covers launch. Connect through the Supavisor pooler string. |
| Cache | **Upstash Redis (serverless)** through StackExchange.Redis over TLS | OTP codes, rate counters, idempotency keys. Pay-per-command fits sparse OTP traffic; no idle fee. |
| Background jobs | **Hangfire** with PostgreSQL storage (`Hangfire.PostgreSql`), in the same container | Replaces BullMQ. Daily food and step syncs, batched analytics flushes, a dashboard behind the admin policy. Needs one warm instance. Revisit Upstash QStash (HTTP push) if that always-on cost bites. |
| Object storage | **Cloudflare R2** through `AWSSDK.S3` against R2's S3-compatible endpoint | Videos, food packs, data exports. Zero egress is the single biggest line-item saving at scale. |
| CDN | **Cloudflare CDN** (22+ India PoPs) | For video and the food pack. Pairs with R2 at zero egress. Pro content uses pre-signed URLs; Worker-verified tokens stay an option. |

### 2.4 Platform integrations

| Capability | Choice | Why |
|---|---|---|
| Auth | `Microsoft.AspNetCore.Authentication.JwtBearer`; a fallback policy requires auth on every endpoint, `[AllowAnonymous]` opts out | ASP.NET Identity is not used: the flow is OTP only, with no passwords. |
| Rate limiting | Built-in `AddRateLimiter` for per-IP limits; Redis counters for per-number and per-device send limits | |
| SMS (India) | A DLT-registered aggregator (MSG91 or Gupshup) over a typed `HttpClient` | Required for Indian OTP delivery. |
| Email | Resend or AWS SES | Email verification, support replies. |
| Store receipt validation | Google Play Developer API (`Google.Apis.AndroidPublisher.v3`), App Store Server API (Apple's `app-store-server-library-dotnet`), cross-checked with the RevenueCat webhook | Belt and braces for Pro state. |
| RevenueCat | Webhooks plus the REST API through a typed `HttpClient` | There is no official RevenueCat .NET SDK. The app uses the React Native SDK; the server only needs the webhook and a lookup call. |
| Attestation checks | Google Play Integrity token decoding (`Google.Apis.PlayIntegrity.v1`), App Attest assertion validation | Verified before any OTP send. App Attest has no official .NET library: budget a small, well-tested validator (CBOR + certificate chain). |
| Observability | OpenTelemetry .NET SDK → Grafana Cloud (Loki, Prometheus, Tempo) | One stack across logs, metrics and traces. |
| Error reporting | Sentry (`Sentry.AspNetCore`) | Same org as the app. |

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
| Tests | xUnit + NSubstitute (unit); `WebApplicationFactory<Program>` with Testcontainers for .NET running Postgres (integration, one per public endpoint) |
| Style | `dotnet format`, Roslyn analyzers, `TreatWarningsAsErrors` |
| Container | Multi-stage Dockerfile: `mcr.microsoft.com/dotnet/sdk:10.0` to build, `mcr.microsoft.com/dotnet/aspnet:10.0` (or the chiseled variant) to run |
| Deploy | **Open question (defer):** AWS App Runner, GCP Cloud Run, or Azure Container Apps — all in a Mumbai region and all run a .NET container. Azure Container Apps has the smoothest .NET tooling; App Runner is cheapest at launch. Hangfire needs a minimum of one running instance, so price the host with `min = 1`. Pick one before the first production deploy. |
| CI | GitHub Actions with `actions/setup-dotnet`: build, unit, integration, publish the image; a job regenerates the OpenAPI document and fails if `shared/` types are stale |
| Secrets | AWS Secrets Manager, GCP Secret Manager or Azure Key Vault, matching the host |

### 2.7 Not using

- **Node.js and NestJS.** Replaced by this decision; see `decisions.md`.
- **ASP.NET Identity.** Built around passwords; OTP-only auth does not need it.
- **GraphQL.** The surface is small and change-light. Not worth the extra complexity.
- **gRPC.** Same.
- **Microservices per feature.** One ASP.NET Core service, six modules, scales horizontally.

## 3 · Shared across the stack

| Area | Choice |
|---|---|
| Source | GitHub `mr-nsin/casafit` |
| CI | GitHub Actions |
| Project tooling | pnpm workspaces for `app/` (React Native) and `shared/` (TypeScript); `api/` is a .NET solution built with `dotnet`, outside pnpm |
| API contract | The API publishes `openapi.json` at build time. `shared/` generates TypeScript request and response types from it (`openapi-typescript`). Hand-written zod schemas for API bodies are retired once generation lands. |
| Duplicated rules | Identifier normalisation (phone to E.164, email canonicalisation) exists twice: in `shared/` (TypeScript) and in `CasaFit.Application` (C#). Both run against the same test vectors in `shared/fixtures/identifiers.json`, so they cannot drift. |
| Monitoring | OpenTelemetry across both runtimes, into Grafana Cloud |

With two languages the OpenAPI document, not a shared package, is the contract between app and API. CI regenerates it and fails the build if the generated types differ from the committed ones.

## 4 · Cost shape

Order-of-magnitude only. All numbers are "roughly" and would be re-quoted before the first user.

| Line | Shape |
|---|---|
| Supabase Pro, Mumbai (Postgres + auth + 100 GB storage) | $25 a month at launch, +$10-110 compute add-on as load grows |
| Upstash Redis (serverless) | Free tier covers launch; ~$3-10 a month at growth |
| App Runner / Cloud Run / Container Apps (one small task, Mumbai, minimum one instance for Hangfire) | $5 to $30 a month at launch, $25 to $90 at growth |
| Cloudflare R2 + Cloudflare CDN (one 50 MB session pack per active user per month) | ~$1 a month at launch; zero CDN egress through growth |
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
- **Two languages, one contract.** The app is TypeScript and the API is C#, so request shapes can drift. The OpenAPI document is the contract, types are generated from it, and CI fails on stale output.
- **Duplicated normalisation.** Phone and email normalisation lives in both TypeScript and C#. Shared JSON test vectors run in both suites; a failing vector blocks the merge.
- **App Attest on .NET.** There is no official server library for App Attest assertions. Treat the validator as security-critical code with its own tests, and spike it before the onboarding backend tasks start.
- **Smaller hiring pool.** Fewer affordable .NET backend developers in India than Node.js ones. Keep the service small, conventional Clean Architecture, and well documented.

## 6 · Pinned versions

Until the first commit, "N or later" is enough. On the first commit, pin exact versions and update `decisions.md`.
