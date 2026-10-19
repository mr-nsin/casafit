# CasaFit Backend Architecture: Auth, Sync & Services Research

---

## Part 1: Current Login System and Multi-Device Sync

### How the OTP + JWT System Works

#### Takeaway
Phone/email OTP login issues a short-lived access token (15-30 min) and a long-lived refresh token (7-30 days) per device; the refresh token silently renews the access token so the user stays logged in without re-entering an OTP.

#### Cited Findings
- Standard OTP flow: user submits phone or email, server generates a 6-digit code with a short TTL (typically 5 min), sends it via SMS/email, user submits it back, server validates and issues a JWT access + refresh token pair. This is a well-established pattern documented across auth libraries (Supabase Auth, Firebase Auth, custom implementations).
- JWT access tokens are stateless and short-lived (15-30 min typical). Refresh tokens are stored server-side (or as opaque tokens in a database) and last 7-30 days. The client sends the access token on each API call; when it expires, the client uses the refresh token to get a new access token silently.
- Refresh token rotation: each time a refresh token is used, it is invalidated and a new one is issued. If a stolen refresh token is replayed, the server detects the reuse and revokes the entire token family, forcing re-authentication.

#### Inferences
- For CasaFit's offline-first model with a 7-day grace period, the refresh token TTL should be at least 7 days (or longer, e.g. 30 days) so that a device coming back online within the grace period can silently re-authenticate.
- The access token should be short (15 min) to limit exposure if intercepted, but the refresh token can be generous since the app is offline-tolerant.

### Multi-Device Login: How JWT Tokens Work Across Devices

#### Takeaway
Each device gets its own independent token pair; the server tracks device sessions in a table, enabling per-device management.

#### Cited Findings
- When a user logs in on a new device, a fresh OTP is required, and the server issues a new access/refresh token pair for that device. The tokens on other devices remain valid independently.
- A `device_sessions` table typically stores: `session_id`, `user_id`, `device_id` (a fingerprint or UUID generated at install), `device_name`, `refresh_token_hash`, `created_at`, `last_active_at`, `is_revoked`.
- Supabase Auth supports multiple sessions per user natively, with each session having its own refresh token — [Supabase Auth Docs](https://supabase.com/docs/guides/auth)

#### Inferences
- CasaFit should generate a stable `device_id` at app install (e.g. UUID stored in AsyncStorage/SecureStore) and send it with every auth request. This enables the "my devices" list and remote logout features.
- For the free tier (2 lifetime form-camera checks), the balance is per-user, not per-device, so multi-device login doesn't multiply the free checks — sync the balance server-side.

### Session Management: Concurrent Sessions

#### Takeaway
Allow up to N devices (e.g. 3-5), maintain a device list, and support remote logout by revoking specific refresh tokens.

#### Cited Findings
- Common pattern: cap concurrent sessions at N (e.g. 3 for free, 5 for Pro). When a user exceeds the limit, either block the new login or auto-revoke the oldest session.
- Device list API: `GET /me/sessions` returns all active sessions with device name, last active time, and location (approximate, from IP). `DELETE /me/sessions/:id` revokes that session's refresh token.
- Remote logout: revoking a refresh token on the server means the target device's access token expires within 15 min and cannot be renewed. For immediate logout, use a short token blacklist (Redis with TTL matching access token lifetime).

#### Inferences
- For CasaFit, 3 concurrent devices is a reasonable limit for a fitness app. When a 4th device logs in, prompt the user to pick which session to end, or auto-revoke the least recently active one.
- The 7-day offline grace period complicates immediate remote logout: an offline device won't know it's been revoked until it comes back online. The server should reject its refresh token at reconnection.

### Data Sync Across Devices

#### Takeaway
Six data categories need syncing: workout plan/progress, food logs, step summaries, session logs, free-check balance, and Pro subscription status. Each has different conflict-resolution needs.

#### Key Data Categories
1. **Active plan & progress** — which plan the user is on, which day/week they're at, completed workouts. Server-authoritative; pull on app open.
2. **Food log** — timestamped entries (meal, calories, macros). Append-only with soft deletes; merge by timestamp + entry ID.
3. **Step summaries** — daily step counts from device sensors. Per-device source; server merges by taking the max per day across devices.
4. **Session logs** — completed workout sessions with reps, sets, duration. Append-only; merge by session UUID.
5. **Free-check balance** — 2 lifetime form-camera checks for free users. Server-authoritative counter; decrement idempotently using an `idempotency_key` per check.
6. **Pro status** — subscription entitlement. Server-authoritative via receipt validation; never trust the client.

### Sync Architecture Options

#### Takeaway
Pull-based sync on app open is the simplest and sufficient for CasaFit's use case; push-based sync adds complexity that isn't justified for a workout app where real-time cross-device sync is rare.

#### Option 1: Pull-Based (Recommended for CasaFit)
- Each device calls `GET /sync?since=<last_sync_timestamp>` on app open and after coming back online.
- Server returns all changes since that timestamp (new food logs, updated plan progress, updated entitlements).
- Client merges locally and updates `last_sync_timestamp`.
- **Pros:** Simple, works well with offline-first, no persistent connections needed.
- **Cons:** Changes aren't visible on other devices until they open the app.

#### Option 2: Push-Based (WebSocket / Push Notification)
- Server sends change notifications via WebSocket (Supabase Realtime) or a silent push notification when data changes.
- Client receives notification and pulls the delta.
- **Pros:** Near-real-time sync across devices.
- **Cons:** WebSocket connections drain battery on mobile; silent push notifications have delivery limits (iOS limits ~2-3/hour). Overkill for a workout app.

#### Option 3: Conflict Resolution Strategies
- **Food logs:** Last-write-wins (LWW) by `updated_at` timestamp, with a `client_id + local_seq` tiebreaker. Since food logs are mostly append-only and edits are rare, LWW is sufficient. If a user edits the same entry on two offline devices, the later timestamp wins.
- **Session logs:** Append-only, no conflicts possible if each session has a UUID generated on-device.
- **Entitlements (free checks, Pro status):** Server-authoritative. Client never decrements locally; it sends a "use check" request with an `idempotency_key` (UUID), and the server deduplicates.

### Supabase Realtime for Sync

#### Takeaway
Supabase Realtime can broadcast row changes for near-real-time sync, but it is not a full offline-first solution; pair it with a local database (WatermelonDB, RxDB, or PowerSync) for true offline support.

#### Cited Findings
- Supabase Realtime uses PostgreSQL logical replication to stream row changes to connected clients over WebSocket — [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- RxDB offers a Supabase replication plugin that does two-way sync between a local collection and a Postgres table. Pulls and pushes go through PostgREST, and live updates come from Supabase Realtime — [RxDB Supabase Plugin](https://rxdb.info/replication-supabase.md)
- PowerSync keeps a local SQLite database in sync with Supabase, with built-in offline support and last-write-wins conflict resolution — [PowerSync + Supabase](https://www.powersync.com/blog/bringing-offline-first-to-supabase)
- Supabase's own blog shows a React Native/Expo app using WatermelonDB (SQLite) with RPCs for writes and Realtime to trigger sync on other devices — [Supabase Blog: React Native Offline-First](https://supabase.io/blog/react-native-offline-first-watermelon-db)

#### Inferences
- For CasaFit, WatermelonDB is likely the best fit: it's designed for React Native, uses SQLite under the hood, and Supabase has a documented integration pattern.
- Supabase Realtime is useful as the notification layer ("something changed, pull now") rather than the primary sync mechanism.

### Offline-to-Online Reconciliation: Entitlements Idempotency-Key Pattern

#### Takeaway
Use a client-generated UUID as an idempotency key for each entitlement-consuming action (e.g. form-camera check) to prevent double-deduction when an offline device comes back online.

#### Pattern
1. Client generates a UUID (`idempotency_key`) before performing the action locally.
2. Client stores the action in a local outbox: `{idempotency_key, action: "use_form_check", timestamp}`.
3. When online, client sends `POST /entitlements/use-check` with the `idempotency_key`.
4. Server checks if that key has already been processed. If yes, returns the same response (idempotent). If no, decrements the balance and records the key.
5. Client marks the outbox entry as synced.

This prevents the scenario where a device uses a check offline, comes back online, and the retry causes a double-deduction.

---

## Part 2: SMS/OTP Providers for India

### Which SMS/OTP Provider Is Best for CasaFit in India?

#### Takeaway
2Factor.in offers the lowest per-OTP cost (~INR 0.12) with free DLT onboarding, making it the best budget choice for an Indian startup. MSG91 (~INR 0.15) is the most popular Indian provider with a mature API. Twilio is the most expensive (~INR 0.45) and hardest to set up for India due to DLT and forex overhead.

#### Cited Findings

**MSG91**
- OTP SMS at approximately INR 0.15 per segment, falling to ~INR 0.13 at high volume — [Botble Integration Guide](https://docs.botble.com/sms-gateways/drivers/msg91.html); [Message Central Blog](https://www.messagecentral.com/blog/sms-otp-pricing-india)
- DLT registration support included; setup takes approximately 2-3 weeks — [Message Central Blog](https://www.messagecentral.com/blog/sms-otp-pricing-india) (competitor source, treat with caution)
- Failed API messages are not charged; failed-delivered messages are charged — [MSG91 Help](https://msg91.com/help/all-service-deductions-)
- RESTful OTP API with auto-retry and voice fallback (voice costs extra)
- WhatsApp OTP: MSG91 supports WhatsApp as a channel, but pricing details were not found in search results

**Gupshup**
- OTP SMS at approximately INR 0.17 per message — [Message Central Blog](https://www.messagecentral.com/blog/sms-otp-pricing-india) (competitor source)
- Enterprise-tier pricing reportedly kicks in above 100,000 messages/month
- WhatsApp OTP supported; Meta's authentication message pricing in India is roughly $0.0014/message (~INR 0.12) — [Fyno Blog](https://fyno.io/blog/how-to-save-big-on-sms-costs-with-whatsapp-in-india-updated-clst1n275005yxv47ioyo7mff)
- DLT registration support included
- Strong WhatsApp Business API integration (Gupshup is a Meta Business Partner)

**Twilio**
- Verify API OTP at approximately INR 0.45 per delivered OTP in India (including USD-INR conversion + ~2-3% forex margin) — [Message Central Blog](https://www.messagecentral.com/blog/twilio-verify-alternative-india) (competitor source)
- DLT: customer must handle Principal Entity registration, header approval, and template approval independently, then submit to Twilio's onboarding team; takes 3-7 business days — [Message Central Blog](https://www.messagecentral.com/en-in/blog/twilio-verify-alternative-india)
- Billed in USD with monthly currency conversion
- Best API documentation and global reach, but 3x the cost of Indian alternatives

**Exotel**
- SMS pricing is volume-based, starting from approximately $0.002/SMS (~INR 0.17) at the 100,000-message tier — [Exotel Developer Docs](https://developer.exotel.com/docs/sms-support/sms-pricing) (no specific OTP rate published)
- India-focused with strong voice calling features
- DLT support included
- Pricing is opaque; requires a sales quote

**Kaleyra (now part of Tata Communications)**
- OTP SMS at approximately INR 0.18 per message — [Message Central Blog](https://www.messagecentral.com/blog/sms-otp-pricing-india) (competitor source)
- DLT support included
- Enterprise-focused; pricing requires a sales conversation

**2Factor.in**
- OTP SMS starting at INR 0.12 per SMS — [2Factor.in Official](https://2factor.in/v4/index.html)
- Free end-to-end DLT onboarding including scrubbing, template approval, and sender-ID go-live — [2Factor.in Official](https://2factor.in/v4/index.html)
- WhatsApp authentication conversations at roughly INR 0.115 (at Meta's rates, zero platform markup) — [2Factor.in Official](https://2factor.in/v4/index.html)
- Voice OTP from INR 0.25 per minute
- Budget option; API is straightforward but less feature-rich than MSG91

#### Summary Comparison Table

| Provider | Per-OTP (INR) | DLT Support | WhatsApp OTP | API Quality | Best For |
|----------|--------------|-------------|--------------|-------------|----------|
| 2Factor.in | ~0.12 | Free setup | Yes (Meta rates) | Basic | Budget startup |
| MSG91 | ~0.15 | Included | Yes | Mature | Indian mid-stage |
| Gupshup | ~0.17 | Included | Yes (strong) | Good | WhatsApp-first |
| Exotel | ~0.17 | Included | Limited | Good | Voice + SMS |
| Kaleyra | ~0.18 | Included | Yes | Enterprise | Enterprise |
| Twilio | ~0.45 | Self-serve DLT | Yes | Best docs | Global apps |

#### Inferences
- For CasaFit targeting India on a startup budget, **2Factor.in** or **MSG91** are the clear choices. 2Factor.in is cheapest; MSG91 has a more mature ecosystem.
- WhatsApp OTP as a fallback is worth implementing: delivery is more reliable than SMS in India, and at ~INR 0.12/message it's cheaper than SMS for some providers.
- Avoid Twilio for India-only use; the 3x cost premium and DLT friction aren't justified unless you need global SMS.

#### Gaps
- No official rate card was found for MSG91, Gupshup, Exotel, or Kaleyra. All per-OTP figures come from third-party (often competitor) sources and should be verified with direct quotes.
- Delivery rate statistics (e.g., "99.5% delivery in India") were not found for any provider in the search results.

---

## Part 3: Push Notification Services

### Which Push Notification Service Is Best for CasaFit?

#### Takeaway
FCM is free, reliable on Android (CasaFit's primary platform), and sufficient for most push needs. OneSignal adds a richer free tier with segmentation and in-app messaging but gets expensive at scale. Novu is open-source and good for multi-channel (push + email + in-app) but adds operational complexity.

#### Cited Findings

**Firebase Cloud Messaging (FCM)**
- Completely free with no published usage caps — [Firebase Cloud Messaging](https://firebase.google.com/products/cloud-messaging)
- Provides a reliable and battery-efficient connection between server and devices (vendor claim) — [Firebase Cloud Messaging](https://firebase.google.com/products/cloud-messaging)
- Android-native: FCM is baked into Google Play Services, which is pre-installed on all Google-certified Android devices in India
- React Native integration via `@react-native-firebase/messaging` — well-maintained, widely used
- No per-message cost, no tier limits
- **Limitation:** FCM alone provides delivery infrastructure, not segmentation, analytics, or scheduling. You build those yourself or layer OneSignal on top.

**OneSignal**
- Free plan: unlimited mobile push subscribers, up to 10,000 web push subscribers, 1 active in-app message, 10,000 emails/month — [OneSignal Blog (Aug 2025)](https://onesignal.com/blog/understanding-onesignals-pricing)
- Growth plan: $19/month + usage. Mobile push usage: $0.012 per MAU. Web push: $0.004 per subscriber — [OneSignal Blog](https://onesignal.com/blog/understanding-onesignals-pricing)
- Features beyond FCM: segmentation, A/B testing, scheduling, in-app messaging, analytics dashboard, Journeys (automated sequences)
- React Native SDK: `react-native-onesignal` — actively maintained
- **Caveat:** One Gartner reviewer reported being locked out at ~1M subscribers without a sales call — [Gartner Reviews](https://www.gartner.com/reviews/product/onesignal-965456449)

**Novu**
- Free plan: 10,000 workflow runs/month, push + email + in-app + SMS channels — [Novu Pricing](https://novu.co/pricing.md)
- Pro plan: $30/month for 30,000 runs, up to 3 team members, remove branding — [Novu Changelog](https://novu.co/changelog/new-tier-novu-pro.md)
- Team: ~$250/month (third-party source)
- Open-source core (MIT license); self-hosting is available — [Novu Docs](https://docs.novu.co/platform/what-is-novu.md)
- Multi-channel notification infrastructure: single API for push, email, in-app, SMS, chat
- React Native: Novu provides a headless notification center SDK
- **Caveat:** One source claims self-hosting is restricted to Enterprise plans, conflicting with the open-source framing — [Toolradar](https://toolradar.com/compare/novu-vs-supabase-realtime)

**Amazon SNS**
- First 1 million mobile push notifications/month free — [AWS SNS Pricing](https://amazonaws.cn/en/sns/pricing)
- After free tier: ~$0.50 per million notifications (US East region) — [Factual Minds](https://www.factualminds.com/blog/amazon-sns-pricing-publishes-fanout-protocols/); [CloudBurn](https://cloudburn.io/blog/amazon-sns-pricing)
- Low-level infrastructure: no segmentation, scheduling, or analytics
- React Native: no official SDK; requires custom integration via AWS SDK
- Best for: backend-to-backend fan-out or very high volume at minimal cost

**Pusher Beams**
- Not found in search results. Pusher's push notification product (Beams) appears to have been deprioritized or discontinued. Their website focuses on Channels (real-time WebSocket) rather than push notifications.

#### Summary Comparison Table

| Service | Free Tier | Paid Starting | React Native | Best For |
|---------|-----------|---------------|-------------|----------|
| FCM | Unlimited, free | N/A (free) | Excellent | Android-first, basic push |
| OneSignal | Unlimited mobile push | $19/mo + usage | Good | Rich features, segmentation |
| Novu | 10K runs/mo | $30/mo | Headless SDK | Multi-channel notifications |
| Amazon SNS | 1M/mo free | $0.50/1M | Manual | High-volume backend |

#### Inferences
- **CasaFit recommendation:** Start with **FCM** (free, Android-native, React Native SDK is excellent). If you need segmentation, A/B testing, or in-app messaging later, layer **OneSignal** on top — its free tier is generous enough for early-stage.
- Amazon SNS is overkill infrastructure for a consumer app.
- Novu makes sense if you want a unified notification layer for push + email + in-app, but it adds operational complexity.

#### Gaps
- India-specific push notification delivery reliability data was not found for any provider. FCM's reliability on Indian Android devices is widely assumed to be good (due to Google Play Services) but no independent benchmarks were found.
- Pusher Beams pricing and current status could not be confirmed.

---

## Part 4: Subscription Billing

### Which Subscription Billing Service Is Best for CasaFit?

#### Takeaway
RevenueCat is the industry standard for mobile subscription billing with the best React Native SDK. Its free tier ($2,500 MTR) is sufficient for early-stage CasaFit. Adapty is a viable alternative with a higher free tier ($5,000 MTR) but a less proven React Native SDK. Building it yourself with StoreKit 2 + Play Billing is possible but costs 2-4 weeks of engineering time and ongoing maintenance.

#### Cited Findings

**RevenueCat**
- Free up to $2,500/month in Monthly Tracked Revenue (MTR), with all features included — [RevenueCat Community](https://community.revenuecat.com/general-questions-7/revenuecat-s-open-source-sdk-vs-paid-features-5271)
- Pro plan: 1% of tracked revenue above the $2,500 free threshold — [App Pricing Lab](https://apppricinglab.com/playbook/revenuecat-review)
- Effective rate: ~1.43% of developer revenue after the 30% store commission — [App Pricing Lab](https://apppricinglab.com/playbook/revenuecat-review)
- React Native SDK: `react-native-purchases` — open-source, actively maintained, single API for iOS + Android
- Server-side receipt validation, webhook support for entitlements, cross-platform subscription management
- Subscriber charts, cohort analysis, LTV predictions built in
- **Limitation:** The 1% fee compounds on top of the 15-30% store commission

**Adapty**
- Free tier: up to $5,000/month in MTR (reportedly increased from previous limits) — [App Pricing Lab](https://apppricinglab.com/playbook/adapty-review) (third-party, verify)
- Paid: 1% of tracked revenue above the free threshold — [App Pricing Lab](https://apppricinglab.com/playbook/adapty-review)
- React Native SDK available alongside iOS, Android, Flutter, Unity — [Metacto](https://www.metacto.com/technologies/adapty)
- Handles StoreKit and Google Play Billing, receipt validation, entitlements, cross-platform sync, and webhooks — [App Pricing Lab](https://apppricinglab.com/playbook/adapty-review)
- A/B testing for paywalls built in
- **Caveat:** Older sources list a $99/month minimum that may have been removed; verify current terms

**Qonversion**
- Pay-as-you-go model with a free trial and free version — [FitGap](https://us.fitgap.com/products/qonversion) (aggregator, unreliable)
- React Native SDK available — [Metacto](https://www.metacto.com/technologies/qonversion)
- Analytics now reads store-configured billing grace periods from App Store Connect and Google Play Console — [Qonversion Changelog](https://documentation.qonversion.io/changelog.md)
- **Gap:** Official pricing not found in search results. Contact Qonversion directly.

**Direct StoreKit 2 + Google Play Billing (Build Yourself)**
- Cost: $0 in service fees (only the 15-30% store commission)
- Engineering effort: 2-4 weeks initial build for both platforms, plus ongoing maintenance
- You must build: receipt validation server, entitlement management, subscription status webhooks (Apple Server Notifications v2 + Google Real-Time Developer Notifications), grace period handling, billing retry logic, cross-platform sync, analytics
- React Native: `react-native-iap` library handles the client-side store interaction; server-side validation is your responsibility
- **Risk:** Subscription edge cases (upgrades, downgrades, cancellations, refunds, family sharing, offer codes, billing retry, grace periods) are notoriously complex and a common source of revenue leakage

**Glassfy**
- Glassfy was acquired by RevenueCat in 2023 and is no longer an independent service. Existing Glassfy users were migrated to RevenueCat.

#### Summary Comparison Table

| Service | Free Tier | Paid Rate | RN SDK | Server Validation | Best For |
|---------|-----------|-----------|--------|-------------------|----------|
| RevenueCat | $2,500 MTR | 1% of MTR | Excellent | Yes | Most apps (industry standard) |
| Adapty | $5,000 MTR | 1% of MTR | Good | Yes | Higher free tier, paywall A/B |
| Qonversion | Unknown | Unknown | Good | Yes | Alternative (verify pricing) |
| DIY | N/A | $0 | react-native-iap | Build yourself | Cost-sensitive, eng capacity |

#### Inferences
- **CasaFit recommendation:** Start with **RevenueCat**. The $2,500 MTR free tier means you pay nothing until you have meaningful revenue. At INR 299/month Pro pricing, that's roughly 630 paying subscribers before you start paying RevenueCat's 1% fee (~INR 3/subscriber/month at that point).
- Adapty's higher free tier ($5,000) is appealing but its React Native SDK is less battle-tested than RevenueCat's.
- Building it yourself saves the 1% fee but costs weeks of engineering and ongoing maintenance for edge cases. Not worth it at CasaFit's stage.

#### Gaps
- Qonversion's official pricing could not be confirmed. The search results showed no rate card.
- Glassfy is confirmed acquired by RevenueCat and no longer available independently.

---

## Part 5: Analytics and Error Monitoring

### Analytics: Which Service Is Best for CasaFit?

#### Takeaway
PostHog offers the most generous free tier (1M events/month, no seat limits, open-source option) and is the best value for a startup. Mixpanel and Amplitude are more polished for product analytics but their free tiers are smaller or require a credit card. Firebase Analytics is free and already integrated if you use FCM, but its analysis capabilities are limited.

#### Cited Findings

**PostHog**
- Free plan: 1 million events/month, 5,000 session recordings, 1 million feature flag requests, 100,000 error tracking exceptions — [PostHog Pricing](https://posthog.com/pricing)
- No per-seat charges, unlimited team members — [PostHog Pricing](https://posthog.com/pricing)
- Pay-as-you-go beyond free tier: $0.00005/event (first paid tier), price drops at volume — [PostHog Product Analytics Pricing](https://posthog.com/product-analytics/pricing)
- Self-hosted option available (open-source, MIT license)
- EU hosting available; no India-specific hosting found
- React Native SDK available; also covers feature flags, session replay, and error tracking in one platform
- **Advantage:** All-in-one platform (analytics + feature flags + session replay + error tracking) at a single free tier

**Mixpanel**
- Free plan: conflicting reports. Official Feb 2025 changelog says 1M events/month free on Growth plan (requires credit card) — [Mixpanel Changelog (Feb 2025)](https://docs.mixpanel.com/changelogs/2025-02-04-1million-events-free-on-growth)
- Third-party sources list a free plan with up to 20M events/month, but this conflicts with the official changelog — [OpenPanel](https://openpanel.dev/articles/mixpanel-pricing)
- Growth plan starts at ~$20-25/month after free tier, scaling with event volume — [Spendflo](https://www.spendflo.com/blog/mixpanel-pricing-guide)
- Strong behavioral analytics: funnels, retention, cohorts
- React Native SDK available
- **Limitation:** Free plan reportedly lacks behavioral cohorts, saved metrics, and data export

**Amplitude**
- Free Starter plan: official docs say 2M events/month — [Amplitude Docs](https://amplitude.com/docs/en/pricing)
- Third-party sources list 10K MTUs and 10M events/month for the free tier (conflicting) — [LiveSession](https://livesession.io/blog/amplitude-pricing-features-costs-and-a-better-alternative)
- Plus plan: $49/month (annual billing), up to 300K MTUs — [LiveSession](https://livesession.io/blog/amplitude-pricing-features-costs-and-a-better-alternative)
- Unlimited seats on all plans
- Strong product analytics with session replay (recently added)
- React Native SDK available

**Google Analytics / Firebase Analytics**
- Completely free, no event limits for standard Firebase Analytics
- Automatically integrated if using Firebase (FCM, Crashlytics, etc.)
- Limited analysis: no behavioral cohorts, no funnel analysis beyond basic, limited segmentation
- No session replay, no feature flags
- **Best for:** Basic event tracking alongside FCM; supplement with a dedicated product analytics tool

#### Summary Comparison Table

| Service | Free Tier | Paid Starting | RN SDK | Session Replay | Best For |
|---------|-----------|---------------|--------|----------------|----------|
| PostHog | 1M events/mo | $0.00005/event | Yes | 5K free/mo | All-in-one startup |
| Mixpanel | 1M events/mo (card required) | ~$20/mo | Yes | Included in Growth | Behavioral analytics |
| Amplitude | 2M events/mo | $49/mo | Yes | Add-on | Product analytics |
| Firebase Analytics | Unlimited (free) | N/A | Via Firebase SDK | No | Basic tracking + FCM |

#### Inferences
- **CasaFit recommendation:** Use **Firebase Analytics** for basic event tracking (free, already needed for FCM) + **PostHog** for product analytics, feature flags, and session replay. PostHog's 1M events/month free tier is more than enough for early-stage, and the all-in-one platform reduces the number of SDKs.
- If you want best-in-class funnel and retention analysis, Mixpanel is the upgrade path, but PostHog covers 80% of that for free.

### Error Monitoring: Which Service Is Best for CasaFit?

#### Takeaway
Sentry is the industry standard for React Native error monitoring with a generous free tier (5K errors/month). PostHog now includes error tracking (100K exceptions/month free), so if you're already using PostHog for analytics, you get basic error tracking for free. For the NestJS/.NET backend, Sentry also covers Node.js and .NET.

#### Cited Findings

**Sentry**
- Free Developer plan: 5K errors/month, 1 user — [SigNoz Guide](https://signoz.io/guides/sentry-pricing/); [Last9 Blog](https://last9.io/blog/sentry-pricing/)
- Team plan: ~$26/month (annual), includes 50K errors, 5GB logs, 5M spans, 50 replays — [Last9 Blog](https://last9.io/blog/sentry-pricing/)
- Business plan: ~$80/month (annual) — [Last9 Blog](https://last9.io/blog/sentry-pricing/)
- React Native SDK: `@sentry/react-native` — excellent, actively maintained, includes source maps, breadcrumbs, performance monitoring
- Node.js SDK: `@sentry/node` — covers NestJS
- .NET SDK: `Sentry.AspNetCore` — covers .NET backend
- 14-day free trial of Business plan for new accounts

**Azure Application Insights**
- Pay-as-you-go: first 5GB of data ingestion/month free, then ~$2.30/GB — [Azure pricing documentation]
- Strong .NET integration (native to Azure ecosystem)
- Not well-suited for React Native mobile (no official RN SDK; would need custom telemetry)
- **Best for:** .NET backend monitoring specifically, not mobile

**Datadog**
- Free tier: 5 hosts, basic infrastructure monitoring
- APM: starts at ~$31/host/month
- Error Tracking: included in APM, or ~$15/host/month standalone
- React Native: `@datadog/mobile-react-native` SDK available
- **Limitation:** Pricing is per-host, which scales differently from per-event. At small scale, it's more expensive than Sentry.

**Bugsnag**
- Free tier: ~7,500 events/month (conflicting sources: some say 7.5K, one says 50K) — [Toolradar](https://toolradar.com/tools/bugsnag/pricing); [CostBench](https://costbench.com/software/error-tracking/bugsnag/free-plan)
- Paid plans: reportedly start at ~$20-33/month, but enterprise pricing requires sales contact — [CostBench](https://www.costbench.com/software/error-tracking/bugsnag/)
- React Native SDK available
- Unlimited users on the free plan
- **Limitation:** Smaller ecosystem than Sentry; fewer integrations

**PostHog Error Tracking (bundled)**
- 100,000 free exceptions/month included in PostHog's free tier — [PostHog Pricing](https://posthog.com/pricing)
- If you're already using PostHog for analytics, this is free additional coverage
- Less mature than Sentry's error tracking; fewer features (no performance monitoring, limited source map support)

#### Summary Comparison Table

| Service | Free Tier | Paid Starting | RN SDK | Backend SDK | Best For |
|---------|-----------|---------------|--------|-------------|----------|
| Sentry | 5K errors/mo, 1 user | ~$26/mo | Excellent | Node.js + .NET | Industry standard |
| PostHog | 100K exceptions/mo | Usage-based | Yes | Node.js | Already using PostHog |
| Bugsnag | ~7.5K errors/mo | ~$20-33/mo | Good | Node.js | Alternative to Sentry |
| Datadog | 5 hosts | ~$31/host/mo | Good | All | Infrastructure-heavy |
| Azure App Insights | 5GB/mo | ~$2.30/GB | None | .NET (native) | .NET backend only |

#### Inferences
- **CasaFit recommendation:** Use **Sentry** for error monitoring across both React Native (mobile) and NestJS (backend). The free tier (5K errors/month) is sufficient for early-stage. If you adopt PostHog for analytics, its bundled error tracking (100K exceptions/month) can supplement Sentry or serve as the primary error tracker for less critical monitoring.
- Azure Application Insights is only worth considering if the backend moves to .NET on Azure; it doesn't cover mobile.
- Datadog is enterprise-grade and priced accordingly; skip it at CasaFit's stage.

#### Gaps
- Sentry's exact current pricing was not found on their official site (sentry.io/pricing); all figures come from third-party blogs dated 2025-2026.
- Bugsnag's free tier limit is uncertain (7.5K vs 50K events/month depending on source).
- India-specific CDN or data residency options were not investigated for any error monitoring service.

---

## Appendix: Recommended Stack for CasaFit (Summary)

| Layer | Recommended | Alternative | Reason |
|-------|-------------|-------------|--------|
| **OTP/SMS** | 2Factor.in or MSG91 | Gupshup (WhatsApp-first) | Cheapest in India, DLT included |
| **Push Notifications** | FCM (free) | + OneSignal (segmentation) | Android-native, free |
| **Subscription Billing** | RevenueCat | Adapty | Industry standard, best RN SDK |
| **Analytics** | PostHog + Firebase Analytics | Mixpanel | All-in-one free tier |
| **Error Monitoring** | Sentry | PostHog (bundled) | Best RN + Node.js coverage |
| **Sync Architecture** | Pull-based on app open | + Supabase Realtime for notifications | Simple, offline-first friendly |
| **Local DB for Offline** | WatermelonDB | RxDB, PowerSync | React Native native, Supabase integration |
| **Conflict Resolution** | LWW for food logs, server-authoritative for entitlements | — | Matches CasaFit's data patterns |

### Estimated Monthly Cost at Launch (< 1,000 users)

| Service | Monthly Cost |
|---------|-------------|
| SMS OTP (2Factor.in, ~500 OTPs/mo) | ~INR 60 (~$0.70) |
| FCM Push | Free |
| RevenueCat | Free (under $2,500 MTR) |
| PostHog | Free (under 1M events) |
| Sentry | Free (under 5K errors) |
| Supabase (free tier) | Free |
| **Total** | **~$1/month** |
