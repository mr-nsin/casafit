# CasaFit · Tech stack

Chosen technologies for the first release. One row per decision. Pricing is at list prices as of October 2026 and is a planning estimate, not a quote.

## 1 · Mobile

| Layer | Choice | Why |
|---|---|---|
| Android language | Kotlin 2.0 | Default for new Android work. First-class with Compose. |
| Android UI | Jetpack Compose (BOM 2026.10) + Material 3 | Matches the design screens. Fast to iterate. |
| Android min SDK | 26 (Android 8) | Covers the India install base; drops a lot of compatibility shims. |
| Android architecture | ViewModel, Flow, Hilt for DI | Standard, boring, and testable. |
| Android local DB | Room 2.7 over SQLite | Typed migrations, good tooling. |
| Android pose runner | MediaPipe Pose Tasks | On-device, good speed on mid-range phones. |
| Android step counter | `Sensor.TYPE_STEP_COUNTER` + Health Connect | Battery-friendly, no GPS. |
| Android billing | Play Billing Library 7 | Required for store subscriptions. |
| Android attestation | Play Integrity API | One of the signals that gates OTP sends. |
| iOS language | Swift 6 | Current, strict-concurrency. |
| iOS UI | SwiftUI, iOS 16+ | Matches Compose for feature parity. |
| iOS architecture | Observable, structured concurrency | Standard. |
| iOS local DB | GRDB.swift over SQLite | Mature, deterministic. |
| iOS pose runner | Vision framework + a shared ONNX model exported from MediaPipe | Keeps Android and iOS producing comparable signals. |
| iOS step counter | Core Motion + HealthKit | Pedometer events, no GPS. |
| iOS billing | StoreKit 2 | Current, async/await friendly. |
| iOS attestation | App Attest | Pairs with Play Integrity on the backend. |
| Analytics SDK (both) | PostHog | Can be self-hosted in India for residency. Only non-health events (see `architecture.md`). |
| Push (both) | FCM for Android, APNs for iOS | Vendor-neutral. |

### Not using

- **React Native, Flutter:** the app is small, the design is Material 3 native on Android and SwiftUI native on iOS, and pose work benefits from the native camera stacks. Revisit if the team changes.
- **A bespoke OpenCV pose model:** MediaPipe is good enough and already supported on both platforms.

## 2 · Backend

| Layer | Choice | Why |
|---|---|---|
| Language | Kotlin on JVM (Ktor 3) | One language with the Android app. Low memory, async by default. |
| Alternative, if the team is Python-first | FastAPI on Python 3.12 | Equivalent fit. Pick one before the first commit. |
| API shape | REST + JSON over HTTPS, versioned at `/v1/` | Simple, debuggable, cacheable. |
| Auth | Short-lived JWTs, refresh tokens in secure storage on the phone | Standard. |
| DB | Postgres 16, managed (AWS RDS or Google Cloud SQL) | Boring and good enough for everything we have. |
| Cache | Redis 7, managed | OTP codes, rate counters. |
| Object store | S3 or Google Cloud Storage | Videos, food packs, data exports. |
| CDN | CloudFront or Cloud CDN | For video and the food pack. |
| SMS vendor, India | A DLT-registered aggregator (MSG91, Gupshup or equivalent) | Required for Indian OTP delivery. |
| Email | Amazon SES or Resend | Email verification and support replies. |
| Monitoring | OpenTelemetry → Grafana Cloud or self-hosted Loki/Prom/Tempo | One stack across logs, metrics and traces. |

### Hosting region

- Primary: `ap-south-1` (AWS Mumbai) or `asia-south1` (GCP Mumbai). India residency, DPDP-aligned.
- Secondary: within the same provider, Indian region, for failover.

## 3 · Dev tooling

| Layer | Choice |
|---|---|
| Source | GitHub (`mr-nsin/casafit`) |
| CI | GitHub Actions, matrix for Android + iOS + backend |
| Design tooling | Material Theme Builder for the palette, Figma for working files, this repo for the final HTML screens |
| Mobile build | Gradle 8.x for Android, Xcode Cloud or Fastlane for iOS |
| App distribution, pre-release | Play Internal Testing, TestFlight |
| Secrets | 1Password or Doppler for the team; AWS Secrets Manager / GCP Secret Manager for runtime |
| Lint and format | ktlint, SwiftLint, ruff/Black if Python |
| Error reporting | Sentry (same stack, three projects) |
| Feature flags | A tiny home-grown table in Postgres with a cached endpoint, until there is a reason to buy one |

## 4 · Cost shape

Order-of-magnitude only. All numbers are "roughly" and would be re-quoted before the first user.

| Line | Shape |
|---|---|
| Mumbai managed Postgres (small) | $60 to $150 a month, scales with usage |
| Redis (small) | $30 to $80 a month |
| Object storage + CDN (one 50 MB session pack per active user per month) | A few cents per active user per month |
| SMS OTP (India) | Roughly ₹0.15 to ₹0.30 per message; must be included in LTV |
| Push | Free at this scale |
| Analytics (self-hosted PostHog) | A single small server for low volume, more as users grow |
| Error reporting | Free tier until usage |

**Per-user AI inference** is zero in v1 because pose analysis runs on the phone. v2 photo food recognition adds roughly $0.0006 per image at the cheap end (see §12 of the PRD).

## 5 · Pinned versions

Until the first commit the versions above are indicative. When the team starts work, replace this section with the exact SDK, library and image versions, and update `decisions.md`.

## 6 · Known risks

- **MediaPipe iOS parity:** the Pose Tasks SDK is Android-first. Verify the iOS path (Vision + exported ONNX) during a one-week spike before committing.
- **SMS cost at scale:** budget separately from server cost; monitor fraud (SMS pumping) and set a daily spend cap.
- **DPDP Act timing:** the Rules apply in full around 13 May 2027. The spec is aligned, but a legal review is required before launch.
- **Store policy changes:** Apple's "server-side analysis" and "biometric-adjacent" rules have moved before. Check both store policies at submission time.
