# CasaFit · Decisions

A short, dated log of design and technical decisions. Add a row at the top. Keep each entry to a few lines; link to the full discussion if there is one.

## 2026-10-19 · React Native + Expo Dev Client for the mobile client
- **Context:** two native codebases (Kotlin/Compose + Swift/SwiftUI) double the maintenance for a small team and slow shipping.
- **Decision:** React Native 0.76 with the New Architecture, Expo SDK 52 with a Dev Client, TypeScript throughout.
- **Why:** one language with the backend, one team, EAS Build removes most CI pain, and the UI ecosystem (`react-native-paper` and friends) covers Material 3.
- **See:** `tech-stack.md` §1, `architecture.md` §2.

## 2026-10-19 · NestJS on Node.js 20 for the backend
- **Context:** we needed to pick one backend language before any code is written.
- **Decision:** NestJS 10, Node.js 20 LTS, Prisma 5 over Postgres 16, Redis 7 for cache and BullMQ.
- **Why:** TypeScript on both sides lets us share DTOs via a `shared/` package, NestJS gives us OpenAPI, DI and modules out of the box, and the hiring pool is deeper than Kotlin/Ktor.
- **See:** `tech-stack.md` §2, `architecture.md` §3.

## 2026-10-19 · RevenueCat for subscription billing
- **Context:** Pro has Google Play and Apple App Store receipts to validate, plus webhooks on renewal and cancellation.
- **Decision:** RevenueCat SDK on the app, webhook into the entitlements module, cross-checked with the store APIs.
- **Why:** removes weeks of StoreKit 2 and Play Billing wiring, gives entitlements and events in one place, and fits our "small team" bias.
- **See:** `tech-stack.md` §1.4 and §2.4, `architecture.md` §3.3.

## Template

```
### YYYY-MM-DD · Short title
- **Context:** one line.
- **Decision:** one line.
- **Why:** one line.
- **See:** PRD section, doc filename, or link.
```

---

## 2026-10-19 · Memory lives in `docs/`
- **Context:** multiple agents are going to work on this repo (see lanes in `CLAUDE.md`).
- **Decision:** every agent reads `docs/MEMORY.md` first, then only the specific docs it needs. Updates write back to the same files.
- **Why:** keeps context small, avoids re-deriving the same facts across turns, and leaves a trail other people can read.
- **See:** `docs-agent.md`, PRD §15.

## 2026-10-19 · Pose runs on the phone
- **Context:** we need form checks on squat, push-up, plank and lunge.
- **Decision:** MediaPipe Pose on Android, Vision + an exported ONNX model on iOS. No server call for the frames.
- **Why:** low cost, DPDP-friendly (frames never leave the device), works offline.
- **See:** `architecture.md` §2.2, `tech-stack.md` §1.

## 2026-10-19 · Rule-based plan engine for v1
- **Context:** the plan is built from a dozen onboarding answers.
- **Decision:** use a rule engine on the phone. No LLM at build time.
- **Why:** free, explainable, works offline, a trainer can review it.
- **See:** PRD §6, `architecture.md` §2.2.

## 2026-10-19 · 2 lifetime free form checks
- **Context:** we needed to pick a quota for free accounts.
- **Decision:** 2 per account, never reset — not on day change, not on reinstall. Pro is unlimited.
- **Why:** matches the PRD and the onboarding-after-value test; a lifetime balance only works if identity is verified first.
- **See:** PRD §14.

## 2026-10-19 · Keep a hashed identifier for 180 days after delete
- **Context:** "Delete my account" could become a loophole to reclaim free credits.
- **Decision:** store a salted HMAC of the normalised identifier on delete, expire the row after 180 days.
- **Why:** stops casual bypass; raw identifier is not retained; period is disclosed in the privacy notice.
- **See:** `data-model.md` §1, PRD §14.

## 2026-10-19 · India residency
- **Context:** DPDP Act will apply in full around 13 May 2027.
- **Decision:** host Indian user data in `ap-south-1` or `asia-south1` Mumbai.
- **Why:** residency, lower latency, aligned with the launch region.
- **See:** `architecture.md` §5, `tech-stack.md` §2.

## 2026-10-19 · One API binary, four packages
- **Context:** we considered microservices per feature.
- **Decision:** one Ktor service with packages for auth, account, entitlements and content.
- **Why:** scale we expect does not justify per-service infra; split later if traffic justifies.
- **See:** `architecture.md` §3.

## 2026-10-19 · No GPS, ever
- **Context:** step counting could use GPS to also show pace and route.
- **Decision:** phone step sensor or Health Connect only.
- **Why:** battery, privacy, DPDP alignment, no distance claim to defend.
- **See:** `architecture.md` §2.2, `data-model.md` §4.

## 2026-10-19 · Three bottom tabs
- **Context:** the PRD originally called for two sections.
- **Decision:** three tabs — Workout, Nutrition, Progress — on the bottom bar.
- **Why:** Material 3 asks for 3 to 5 destinations; Steps and Learn fit under Workout, Progress deserves its own place.
- **See:** the Material 3 screens in `project/`.
