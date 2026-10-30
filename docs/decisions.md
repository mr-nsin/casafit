# CasaFit · Decisions

A short, dated log of design and technical decisions. Add a row at the top. Keep each entry to a few lines; link to the full discussion if there is one.

## 2026-10-26 · ASP.NET Core on .NET 10 LTS for the backend
- **Context:** the architecture report (`reports/CasaFit backend architecture options.md`) mapped NestJS to ASP.NET Core one-to-one and found the architecture, hosting and data choices unchanged. The product owner chose .NET.
- **Decision:** ASP.NET Core Web API on .NET 10 LTS (C# 14). EF Core 10 + Npgsql replaces Prisma, Hangfire (PostgreSQL storage) replaces BullMQ, FluentValidation replaces class-validator, built-in JWT bearer auth and rate limiting replace the Nest guards and throttler, xUnit + `WebApplicationFactory` + Testcontainers replace Jest and Supertest. The mobile client stays React Native + TypeScript.
- **Why:** stronger compile-time safety on the entitlement and billing paths, native Azure path, better raw throughput, and the owner's preferred stack. Start on .NET 10, not 8: .NET 8 LTS leaves support in November 2026.
- **Costs accepted:** a full rewrite of the scaffolded `api/` (nothing is deployed yet), no shared TypeScript package with the app, no official RevenueCat or App Attest server library (typed `HttpClient` and a custom validator), and a smaller .NET hiring pool in India.
- **Consequences:** the OpenAPI document becomes the app/API contract and `shared/` generates types from it. Identifier normalisation exists in TypeScript and C#, both run against `shared/fixtures/identifiers.json`. Hangfire needs one warm instance, so price the host with `min = 1`.
- **Supersedes:** "NestJS on Node.js 20 for the backend" (2026-10-19).
- **See:** `tech-stack.md` §2 and §3, `architecture.md` §3, `api/README.md`.

## 2026-10-20 · Supabase Pro (Mumbai) for Postgres
- **Context:** choosing a managed Postgres host; backend research pack scored AWS RDS vs Google Cloud SQL vs Supabase Pro in `ap-south-1`.
- **Decision:** Supabase Pro, Mumbai (`ap-south-1`), $25/mo at launch. Replaces the earlier "AWS RDS or Google Cloud SQL" placeholder.
- **Why:** DPDP-compliant Mumbai region, bundles Postgres + Supavisor pooling + auth + 100 GB storage + daily backups, cheapest path to a production DB; we can still run the API in front for business logic (ASP.NET Core since 2026-10-26).
- **See:** `tech-stack.md` §2.3, `reports/CasaFit backend architecture options.md`.

## 2026-10-20 · Upstash serverless Redis for cache
- **Context:** Redis for OTP codes, rate limits and idempotency keys has very sparse traffic; always-on managed Redis idles most of the day.
- **Decision:** Upstash Redis (serverless) with Mumbai region, pay-per-command. Replaces the earlier "Redis 7 managed, Mumbai" placeholder.
- **Why:** Free tier covers launch, ~$3-10/mo at growth, no VPC plumbing. BullMQ was the queue library here; Hangfire on Postgres replaces it from 2026-10-26. Revisit QStash if worker always-on cost becomes material.
- **See:** `tech-stack.md` §2.3, `reports/CasaFit backend architecture options.md`.

## 2026-10-20 · Cloudflare R2 + Cloudflare CDN for media
- **Context:** CDN egress is the dominant cost driver for a video-heavy app; S3 + CloudFront is $0.109/GB after 1 TB.
- **Decision:** Cloudflare R2 for video and food-pack storage, Cloudflare CDN (22+ India PoPs) in front. Replaces the earlier "S3 or GCS + CloudFront or Cloud CDN" placeholder.
- **Why:** Zero egress fees keep CDN flat as video traffic grows (~$7/mo at 20 TB vs ~$1,760 on CloudFront); R2 has no Mumbai origin region but the CDN caches in India so the origin hop is one-off per asset. Signed URLs via Workers for Pro content.
- **See:** `tech-stack.md` §2.3, `architecture.md` §3.4, `reports/CasaFit backend architecture options.md`.

## 2026-10-20 · Defer the API host choice to App Runner / Cloud Run / Container Apps
- **Context:** the earlier doc said "ECS Fargate or Cloud Run, pick one before the first commit." The research pack narrows the field but does not pick a winner.
- **Decision:** defer. Shortlist is **AWS App Runner (Mumbai)**, **GCP Cloud Run (Mumbai)**, **Azure Container Apps (Pune/Chennai/Mumbai)** — all scale-to-near-zero, all DPDP-compliant. App Runner is cheapest at launch (~$5-7/mo); Cloud Run and Container Apps have the largest free grants. Decide before the first production deploy.
- **Why:** cost delta is small at launch, and the choice can live inside one Dockerfile. Picking it later lets us weight whichever cloud we already run secrets, logs and CI artefacts in.
- **See:** `tech-stack.md` §2.6, `architecture.md` §3.

## 2026-10-19 · React Native + Expo Dev Client for the mobile client
- **Context:** two native codebases (Kotlin/Compose + Swift/SwiftUI) double the maintenance for a small team and slow shipping.
- **Decision:** React Native 0.76 with the New Architecture, Expo SDK 52 with a Dev Client, TypeScript throughout.
- **Why:** one language with the backend, one team, EAS Build removes most CI pain, and the UI ecosystem (`react-native-paper` and friends) covers Material 3.
- **See:** `tech-stack.md` §1, `architecture.md` §2.

## 2026-10-19 · NestJS on Node.js 20 for the backend (superseded 2026-10-26)
- **Context:** we needed to pick one backend language before any code is written.
- **Decision:** NestJS 10, Node.js 20 LTS, Prisma 5 over Postgres 16, Redis 7 for cache and BullMQ.
- **Why:** TypeScript on both sides lets us share DTOs via a `shared/` package, NestJS gives us OpenAPI, DI and modules out of the box, and the hiring pool is deeper than Kotlin/Ktor.
- **See:** `tech-stack.md` §2, `architecture.md` §3.

## 2026-10-19 · RevenueCat for subscription billing
- **Context:** Pro has Google Play and Apple App Store receipts to validate, plus webhooks on renewal and cancellation.
- **Decision:** RevenueCat SDK on the app, webhook into the entitlements module, cross-checked with the store APIs.
- **Why:** removes weeks of StoreKit 2 and Play Billing wiring, gives entitlements and events in one place, and fits our "small team" bias.
- **See:** `tech-stack.md` §1.4 and §2.4, `architecture.md` §3.3.

## 2026-10-19 · Plan: first-run and onboarding
- **Context:** the agent team needs a worked example and a concrete first feature.
- **Decision:** project-manager wrote `docs/plans/onboarding.md` for PRD §5, §6 and §14, with 11 tasks across ux, content, backend, mobile and qa.
- **Why:** onboarding is the critical path; it also exercises every agent at least once.
- **See:** `docs/plans/onboarding.md`.

## 2026-10-19 · Monorepo scaffolded: app, api, shared
- **Context:** we needed a floor on which the engineers can write code.
- **Decision:** pnpm workspace with `app/` (Expo + React Native + TypeScript), `api/` (NestJS + Prisma + Postgres), `shared/` (zod schemas for identifiers, auth, entitlements, plan).
- **Why:** TypeScript on both sides lets us import the same request and response types; one `pnpm install` sets up the whole thing.
- **See:** `package.json`, `pnpm-workspace.yaml`, `app/README.md`, `api/README.md`.

## 2026-10-19 · First slice shipped as scaffold
- **Context:** show the agent team end-to-end.
- **Decision:** Welcome and Verify screens on the app, `POST /v1/auth/code` and `/v1/auth/verify` on the api, identifier normalisation shared in `@casafit/shared`, Jest unit for normalisation and OTP, Supertest e2e for the two endpoints.
- **Why:** one running feature anchors the plan; the rest fills in behind it.
- **See:** `app/src/screens/`, `api/src/modules/auth/`, `shared/src/`.

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

- 2026-10-30 · API hosting: Railway for the beta (simple Docker deploy, Postgres and Redis add-ons, Singapore region), Google Cloud Run asia-south1 (Mumbai) for launch so data stays in India. The API is a stateless container, so the move is a change of host and connection strings.
