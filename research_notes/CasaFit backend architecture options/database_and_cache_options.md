# CasaFit Backend Data Infrastructure Options

## Part 1: Database Options

### Supabase (Managed Postgres + BaaS)

#### Takeaway
Supabase offers a compelling all-in-one BaaS (auth, database, storage, edge functions, realtime) with a generous free tier and a $25/mo Pro tier. Mumbai (ap-south-1) region reportedly became available in November 2025, making it viable for DPDP compliance. However, edge function limits (256 MB RAM, 2s CPU) mean heavy backend logic still needs a standalone server.

#### Cited Findings
- **Free tier:** $0/mo — 500 MB database, 50,000 MAUs, 1 GB storage, 5 GB egress, 500K edge function invocations, community support. Limited to 2 active projects; paused after 1 week of inactivity. — [Supabase Pricing Page](https://supabase.com/pricing)
- **Pro tier:** From $25/mo per organization — 8 GB database disk, 100,000 MAUs, 100 GB storage, 250 GB egress, 2M edge function invocations, email support, 7-day backups. Includes $10/mo in compute credits (one Micro instance: shared vCPU, 1 GB RAM). — [Supabase Pricing Page](https://supabase.com/pricing)
- **Team tier:** From $599/mo — same allowances as Pro, plus 14-day backups, SOC 2, ISO 27001, SSO, priority support with SLAs. — [Supabase Pricing Page](https://supabase.com/pricing)
- **Compute add-ons:** Micro $10/mo (shared vCPU, 1 GB RAM), Small $15/mo (shared, 2 GB), Medium $60/mo (shared, 4 GB), Large $110/mo (2 dedicated vCPU, 8 GB). — [Supabase Pricing Page](https://supabase.com/pricing)
- **Overage rates (Pro/Team):** Database disk $0.125/GB, egress $0.09/GB, storage $0.0213/GB, edge functions $2/million beyond allowance. — [Supabase Pricing Page](https://supabase.com/pricing)
- **Mumbai region:** A 2026 blog post reports Supabase shipped AWS ap-south-1 (Mumbai) as a primary region in November 2025, including a migration guide. — [Rohit Raj Tech Blog](https://rohitraj.tech/notes/supabase-vs-firebase-india-mvp-2026)
- **Phone OTP:** Supabase Auth supports `signInWithOtp` with phone number, sending a 6-digit code valid for 60 seconds. Requires configuring an SMS provider (Twilio, Twilio Verify, or custom). WhatsApp delivery is also supported via Twilio. — [Supabase Phone Login Docs](https://supabase.com/docs/guides/auth/phone-login)
- **Edge Functions limits:** 256 MB max memory, 2s CPU time per request, 150s wall-clock timeout. No Web Worker API, no multithreading (sharp/libvips not supported). — [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- **Edge Functions capabilities:** Node.js compatible, supports 2M+ NPM modules. Database webhooks can trigger functions on INSERT/UPDATE/DELETE events. — [Supabase Edge Functions](https://supabase.com/edge-functions)
- **Connection pooling:** Supabase includes Supavisor (built-in connection pooler) with both transaction-mode and session-mode pooling. — [Supabase Docs](https://supabase.com/docs)
- **Backups:** Free tier gets no backups. Pro gets daily backups (7-day retention). Team gets 14-day retention. — [Supabase Pricing Page](https://supabase.com/pricing)

#### Inferences
- At $25/mo (Pro) with Mumbai region, Supabase is the cheapest way to get a production Postgres database with auth, storage, and realtime for a startup. The $10 compute credit effectively means the Micro instance is included.
- For CasaFit's use case (accounts, plans, food entries, step summaries, session logs), the 8 GB database disk on Pro should suffice for the first 50K-100K users.
- Supabase Auth with phone OTP could replace a custom OTP system, but you would still need an SMS provider (MSG91 or Twilio) and the 60-second OTP window is shorter than the typical 5-minute window in India. Custom OTP logic via edge functions or a backend server may be preferred.
- Edge functions cannot replace a full NestJS backend for heavy processing (image manipulation, PDF generation, complex analytics), but can handle lightweight API endpoints, webhooks, and auth hooks.
- A hybrid architecture (Supabase for auth + DB + storage, NestJS for heavy business logic) is a pragmatic middle ground.

#### Gaps
- Official Supabase region list was not found in search results; Mumbai availability is based on a third-party blog post, not official docs. Verify in the Supabase project creation UI.
- Supabase's support for India-specific SMS providers (MSG91, Gupshup) beyond Twilio is unclear.
- No data found on Supabase's latency from Mumbai region or cold-start times for edge functions in ap-south-1.

---

### AWS RDS for PostgreSQL

#### Takeaway
AWS RDS PostgreSQL in Mumbai (ap-south-1) starts at ~$15/mo for db.t4g.micro (2 vCPUs, 1 GB RAM) on-demand, plus storage costs. It offers the most mature managed Postgres with full control, but has no free tier (only a 12-month free-trial micro instance for new accounts) and requires more operational setup than BaaS options.

#### Cited Findings
- **db.t4g.micro (2 vCPU, 1 GB RAM) — Mumbai:** On-demand $15/mo, 1-year reserved $11/mo, 3-year reserved $9/mo. — [Bytebase DB Cost](https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/)
- **db.t4g.small (2 vCPU, 2 GB RAM) — Mumbai:** On-demand $31/mo, 1-year reserved $23/mo, 3-year reserved $18/mo. — [Bytebase DB Cost](https://www.bytebase.com/dbcost/rds/instance/db.t4g.small/)
- **Storage:** General Purpose (gp3) SSD starts at $0.133/GB-month in ap-south-1 (estimated based on AWS global pricing; verify on AWS). 20 GB minimum. Provisioned IOPS (io1) is more expensive.
- **Backups:** Automated backups up to the DB instance storage size are free. Additional backup storage is charged at ~$0.095/GB-month.
- **Free tier (new accounts only):** 750 hours/month of db.t3.micro or db.t4g.micro for 12 months plus 20 GB gp2 storage. — [AWS RDS Free Tier](https://aws.amazon.com/rds/free/)
- **Connection pooling:** Not built-in; requires RDS Proxy ($0.015/vCPU-hour) or a self-managed PgBouncer.

#### Inferences
- A db.t4g.micro ($15/mo) + 20 GB gp3 storage (~$2.66/mo) = ~$18/mo for a minimal production setup. This is competitive but has no built-in auth/storage/realtime like Supabase.
- Scaling path is clear: t4g.small ($31/mo), t4g.medium (~$60/mo), then t3/r-class instances for heavier workloads.
- RDS Proxy adds cost but is important for serverless or high-connection-count workloads (Lambda, mobile apps with many concurrent connections).
- Best choice if you already have AWS infrastructure and want full Postgres control.

#### Gaps
- db.t4g.medium and db.t3.medium Mumbai pricing not found in search results. Verify on AWS pricing calculator.
- Exact gp3 storage pricing for ap-south-1 not confirmed from official source.

---

### Azure Database for PostgreSQL — Flexible Server

#### Takeaway
Azure Flexible Server is available in Central India (Mumbai equivalent) with Burstable B1ms starting around $12-15/mo (estimated, exact Mumbai price not confirmed). It competes with RDS on features but pricing is harder to pin down from public sources.

#### Cited Findings
- **Tiers:** Burstable (B-series, 1-20 vCPUs), General Purpose (D-series, 2-96 vCPUs), Memory Optimized (E-series). — [Microsoft Learn](https://learn.microsoft.com/en-AU/azure/postgresql/flexible-server/concepts-compute-storage)
- **B1ms (1 vCPU, 2 GB RAM):** Approximately $12-15/mo on-demand in US regions (compute only). Mumbai price expected to be similar or slightly higher. — [Bytebase](https://www.bytebase.com/dbcost/azure-flexible-server-pricing/)
- **Central India region:** Available. Azure's India locale pricing page exists but showed placeholder values in search results. — [Azure Pricing (India)](https://azure.microsoft.com/en-in/pricing/details/postgresql/flexible-server/)
- **Storage:** Billed separately. 32 GB minimum on some tiers. Premium SSD v2 available.
- **Backups:** Up to 35-day retention. Geo-redundant backup available at extra cost.
- **Connection pooling:** Built-in PgBouncer available on Flexible Server.

#### Inferences
- B1ms (~$15/mo) + 32 GB storage (~$4/mo) = ~$19/mo estimated for Central India. This is comparable to AWS RDS.
- Built-in PgBouncer is a nice advantage over RDS (which charges for RDS Proxy).
- Good choice if the rest of the stack is on Azure. Otherwise, no significant advantage over RDS or Supabase.

#### Gaps
- Exact Central India pricing for B1ms, B2s, and D2s_v3 could not be confirmed from search results. Must check Azure pricing calculator.
- No free tier for Flexible Server (Azure's free tier for Postgres was limited to a now-deprecated Single Server).

---

### Neon (Serverless Postgres)

#### Takeaway
Neon offers serverless Postgres with scale-to-zero, usage-based pricing starting at $0/mo (free tier) and ~$19/mo (Launch tier). However, India region availability is unconfirmed, which is a potential blocker for DPDP compliance.

#### Cited Findings
- **Free tier:** $0/mo with 0.5 GB storage, limited compute hours. One project, 10 branches. — [Neon Pricing](https://neon.tech/pricing)
- **Launch tier:** ~$19/mo for 10 GB storage and 100 compute hours. Usage-based beyond that. $5/mo minimum spend implemented August 2024. — [Bytebase Comparison](https://www.bytebase.com/blog/postgres-hosting-options-pricing-comparison/)
- **Scale tier:** Higher limits, more branches, more storage. Exact price not confirmed in results.
- **Scale-to-zero:** Databases automatically suspend when idle, so you only pay for active compute time. This is unique among Postgres providers.
- **Branching:** Instant database branching for development/testing, similar to git branches.
- **Acquisition:** Databricks agreed to acquire Neon in May 2025 for ~$1 billion. Neon continues as a standalone product. — [Sacra Research](https://sacra.com/research/neon)
- **Regions:** Runs on AWS regions worldwide, but specific India/Mumbai availability not confirmed. — [Neon Docs](https://neon.tech/docs)

#### Inferences
- Scale-to-zero makes Neon potentially the cheapest option for a pre-launch or low-traffic app. You pay nothing when the database is idle.
- If Mumbai region is not available, data residency requirements would rule this out for CasaFit.
- Databricks acquisition may bring changes to pricing or features.
- Connection pooling is built-in.

#### Gaps
- India/Mumbai region availability could not be confirmed. This is a critical gap — check Neon's region list before considering this option.
- Latency from nearest available region (likely Singapore ap-southeast-1) to Indian users is unknown.

---

### PlanetScale (Serverless MySQL on Vitess)

#### Takeaway
PlanetScale offers serverless MySQL built on Vitess with usage-based pricing starting at ~$5/mo. However, it uses MySQL (not Postgres), has no confirmed India region, and removed its free tier in 2024. Not recommended for CasaFit given the Postgres preference and India data residency requirement.

#### Cited Findings
- **Base pricing:** Starting at ~$5/mo usage-based. No free tier (removed in 2024). — [PlanetScale Pricing via aggregators](https://pricingsaas.com/companies/planetscale)
- **Scaler Pro:** Reportedly ~$39/mo + usage, conflicting with other aggregator data. — [CostBench](https://www.costbench.com/software/database-as-service/planetscale/hidden-costs/)
- **Built on Vitess:** MySQL-compatible, not Postgres. Horizontal sharding is built-in.
- **Branching:** Database branching for schema changes, similar to Neon.
- **India region:** No India/Mumbai region found in search results.

#### Inferences
- MySQL instead of Postgres is a significant drawback when the rest of the stack assumes Postgres (Supabase, Prisma defaults, etc.).
- No confirmed India region makes this unsuitable for DPDP compliance.
- Higher starting cost than alternatives like Supabase or Neon free tiers.
- Not recommended for CasaFit.

#### Gaps
- Official region list not confirmed. May have added India since search data was collected.
- Exact current pricing structure is unclear due to conflicting aggregator data.

---

### Google Cloud SQL for PostgreSQL

#### Takeaway
Cloud SQL is available in Mumbai (asia-south1) and offers Enterprise and Enterprise Plus editions. Pricing for small instances is competitive with RDS but slightly harder to estimate due to per-vCPU/per-GB-RAM billing. No free tier.

#### Cited Findings
- **Mumbai (asia-south1):** Available for both Enterprise and Enterprise Plus editions. — [Google Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- **Pricing model:** Per-vCPU-hour + per-GB-RAM-hour + storage. The base rate is approximately $0.0413/vCPU-hour for Enterprise (region unspecified in snippet). — [Google Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- **Estimated small instance:** A db-custom-1-3840 (1 vCPU, 3.75 GB RAM) runs roughly $35-50/mo in most regions (compute only). Mumbai likely similar or slightly higher.
- **Committed use discounts:** 1-year and 3-year commitments available for reduced pricing.
- **Storage:** SSD storage billed per GB-month. Backups billed separately.
- **Connection pooling:** Not built-in; Cloud SQL Auth Proxy handles secure connections but is not a pooler. Consider PgBouncer on a VM or AlloyDB for built-in pooling.

#### Inferences
- More expensive than RDS or Azure for equivalent specs at the small instance level.
- Best choice if you are already invested in GCP ecosystem.
- AlloyDB (Google's Postgres-compatible database) may be worth considering for higher performance needs but is significantly more expensive.

#### Gaps
- Exact Mumbai pricing for the smallest instances not confirmed. Must use GCP pricing calculator.
- Minimum vCPU/RAM configuration for Cloud SQL not confirmed (may be higher than 1 vCPU/1 GB).

---

### CockroachDB

#### Takeaway
CockroachDB's Basic (formerly Serverless) tier offers a generous free allotment (50M Request Units + 10 GiB storage/month) with usage-based pricing beyond that. However, India region availability is unconfirmed, and the pricing model (Request Units) makes cost estimation harder compared to traditional instance-based pricing.

#### Cited Findings
- **Basic (Serverless) pricing:** $0.20 per million Request Units, $0.50 per GiB storage. Free allotment: 50M RUs + 10 GiB storage per month per organization. — [CockroachDB Pricing Docs](https://www.cockroachlabs.com/docs/cockroachcloud/learn-about-pricing.html)
- **Tier naming:** Old "Serverless" is now "Basic". Old "Dedicated" split into "Standard" and "Advanced". — [CockroachDB Docs](https://www.cockroachlabs.com/docs/cockroachcloud/learn-about-pricing.html)
- **Regions:** Basic and Standard share a curated set of AWS and GCP regions. India/Mumbai not confirmed in search results.
- **Distributed SQL:** Automatic sharding, multi-region replication, and strong consistency. Overkill for a single-region app but valuable if you expand beyond India.

#### Inferences
- The free allotment is generous for development and early-stage apps. 50M RUs can handle a reasonable amount of read/write traffic.
- Request Unit pricing makes cost unpredictable compared to fixed instance pricing. A simple read costs 1 RU, a write costs more. Complex queries consume more RUs.
- If India region is not available, this is not viable for DPDP compliance.
- CockroachDB's distributed architecture adds complexity that CasaFit likely doesn't need at launch.

#### Gaps
- India/Mumbai region availability not confirmed. Critical blocker.
- How many RUs typical CasaFit operations would consume is unknown, making cost estimation difficult.

---

## Part 2: Cache and Queue Options

### Upstash Redis (Serverless)

#### Takeaway
Upstash offers serverless Redis with pay-per-command pricing, a free tier, and reportedly uniform pricing across all regions including ap-south-1 (Mumbai). It is the most startup-friendly cache option for CasaFit, with costs starting at $0 and scaling linearly with usage.

#### Cited Findings
- **Free tier:** $0/mo — 256 MB data, 500K commands/month, 10 GB bandwidth, 10K max commands/sec, 1 database. — [Upstash Billing Docs](https://upstash.com/docs/redis/overall/billing)
- **Pay-as-you-go:** $0.20 per 100K commands, $0.25/GB storage/month (first 1 GB free), bandwidth free up to 200 GB/month then $0.03/GB. — [Upstash Billing Docs](https://upstash.com/docs/redis/overall/billing)
- **Fixed plans:** Start at $10/mo (Fixed 250 MB). — [Dragonfly Guide on Upstash](https://www.dragonflydb.io/guides/upstash-solution-overview-pros-cons-and-alternatives)
- **Regional pricing:** One third-party comparison reports Upstash uses a single price across all regions, including ap-south-1 (Mumbai). — [SelfHost.dev Comparison](https://selfhost.dev/blog/managed-redis-pricing-comparison/)
- **Multi-region caveat:** Global (multi-region) databases replicate every write to each read region, and each replication counts as a billable command. — [Dragonfly Guide](https://www.dragonflydb.io/guides/upstash-solution-overview-pros-cons-and-alternatives)
- **TTL support:** Standard Redis TTL commands (SETEX, EXPIRE) are supported, making it suitable for OTP storage with 5-minute expiry.
- **Latency:** Not specifically measured for Mumbai, but as a serverless product, expect slightly higher latency than a dedicated Redis instance in the same region.

#### Inferences
- For CasaFit's use case (OTP codes with 5-min TTL, rate limiting, idempotency keys), Upstash's free tier (500K commands/month) could cover early-stage needs.
- At scale, a simple OTP flow (SET + GET + DEL = 3 commands per OTP) at 10K OTPs/day = 900K commands/month = ~$1.80/mo on pay-as-you-go. Very cheap.
- Rate limiting with sorted sets or simple counters adds minimal cost.
- Single-region deployment recommended to avoid replication billing on multi-region.

#### Gaps
- Exact latency from Upstash's Mumbai endpoint not measured. Need to verify actual p50/p99 latency.
- Whether Upstash's Mumbai region is a true ap-south-1 deployment or proxied from Singapore is unclear.

---

### AWS ElastiCache for Redis

#### Takeaway
ElastiCache provides dedicated Redis instances in Mumbai (ap-south-1). The smallest instance (cache.t4g.micro) costs approximately $12-16/mo. It offers the lowest latency for an AWS-hosted backend but has no free tier and requires VPC configuration.

#### Cited Findings
- **cache.t4g.micro (2 vCPU, 0.5 GB RAM) — US East:** $0.016/hr Redis OSS (~$11.68/mo), $0.0128/hr Valkey (~$9.34/mo). Mumbai pricing expected to be 10-20% higher. — [Dragonfly FinOps](https://www.dragonflydb.io/finops/elasticache/cache.t4g.micro); [Upstash Blog Comparison](https://upstash.com/blog/upstash-vs-aws-elasticache-serverless-redis-pricing-and-performance-2026)
- **Estimated Mumbai pricing:** cache.t4g.micro ~$13-16/mo, cache.t4g.small (~$26-32/mo), cache.t3.small (~$28-34/mo). These are estimates based on typical Asia-Pacific markup over US East prices.
- **Valkey discount:** AWS prices Valkey (Redis fork) approximately 20% below Redis OSS on the same node types. — [Upstash Blog](https://upstash.com/blog/aws-elasticache-pricing-explained-2026-full-cost-breakdown)
- **No free tier:** ElastiCache has no permanent free tier. New AWS accounts may get limited free usage.
- **Connection:** Requires VPC. Not directly accessible from outside AWS without VPN or NAT.

#### Inferences
- At ~$14/mo for a dedicated Redis instance in Mumbai, ElastiCache offers predictable pricing and lowest latency if the backend runs on EC2/ECS/EKS in the same VPC.
- Valkey is a drop-in Redis replacement that saves ~20% — worth considering since CasaFit doesn't need Redis-specific commercial features.
- Overkill for early-stage when Upstash free tier would suffice. Consider migrating to ElastiCache when you need dedicated performance guarantees.

#### Gaps
- Exact Mumbai pricing for cache.t4g.micro not confirmed from official AWS source. Must verify on AWS pricing page.
- ElastiCache Serverless pricing (newer option) for Mumbai not researched.

---

### Azure Cache for Redis

#### Takeaway
Azure Cache for Redis is available in Central India (Mumbai equivalent). The Basic C0 tier is the entry point but has no SLA and shared CPU. Pricing is approximately $16-20/mo for Basic C0 (estimated, exact Central India price not confirmed).

#### Cited Findings
- **Central India availability:** Confirmed. Premium tier has been available in India since at least 2016. Basic and Standard tiers also available. — [Azure Update](https://azure.microsoft.com/updates/generally-available-azure-redis-cache-premium-tier-in-india-and-canada/)
- **Basic C0 (250 MB, shared CPU):** Approximately $16/mo in US regions. No SLA. Suitable for dev/test only. — [Azure Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)
- **Standard C0 (250 MB, dedicated CPU, replication):** Approximately $40/mo in US regions. Includes SLA and replication.
- **Standard C1 (1 GB, dedicated CPU):** Approximately $80/mo in US regions.
- **No free tier.**

#### Inferences
- Significantly more expensive than Upstash or ElastiCache for equivalent functionality.
- Basic C0 has no SLA and shared CPU — not suitable for production OTP/rate-limiting.
- Standard C0 at ~$40/mo is expensive for a startup's cache needs.
- Only recommended if the entire stack is on Azure and you need VPC-level integration.

#### Gaps
- Exact Central India pricing not confirmed. Must check Azure pricing calculator.
- Azure Cache for Redis Enterprise tier (Redis Ltd.'s modules) pricing in India not researched.

---

### Dragonfly (Self-Hosted Redis Alternative)

#### Takeaway
Dragonfly is an open-source, drop-in Redis replacement that claims 25x better throughput on the same hardware. Self-hosted on a VM in Mumbai, it eliminates managed-service costs but adds operational burden.

#### Cited Findings
- **Open source:** Apache 2.0 licensed. Drop-in replacement for Redis with multi-threaded architecture. — [Dragonfly](https://www.dragonflydb.io/)
- **Performance claims:** Up to 25x better throughput than Redis on the same hardware, using fewer resources for the same workload.
- **Self-hosted cost:** The cost is the underlying VM. An AWS t4g.micro ($8-10/mo in Mumbai) or equivalent would suffice for CasaFit's cache needs.
- **Managed offering:** Dragonfly Cloud exists but India region availability and pricing not researched.

#### Inferences
- Self-hosting Dragonfly on a small VM (~$10/mo) is the cheapest way to get a dedicated Redis-compatible cache in Mumbai.
- Adds operational overhead (updates, monitoring, backups) that managed services handle.
- Good option if you already manage VMs for other parts of the stack.
- Not recommended for a lean startup unless you have DevOps capacity.

#### Gaps
- Dragonfly Cloud region availability and pricing not researched.
- Benchmark data for CasaFit-scale workloads not available.

---

### Redis Cloud (Redis Ltd.)

#### Takeaway
Redis Cloud is the official managed Redis service from Redis Ltd. Mumbai availability is likely (they support major AWS/GCP/Azure regions) but was not confirmed in search results. Pricing tends to be higher than ElastiCache or Upstash.

#### Cited Findings
- **Pricing model:** Fixed plans based on dataset size and throughput. No per-command billing. — [Upstash Blog on Redis Cloud Pricing](https://upstash.com/blog/redis-cloud-pricing-in-2026-plans-costs-and-real-examples)
- **Free tier:** 30 MB database, limited to one database. Suitable for prototyping only.
- **Paid plans:** Start around $5-7/mo for small fixed plans, but production-grade plans with replication start at $50+/mo.
- **Mumbai availability:** Not confirmed in search results. Redis Cloud supports AWS, GCP, and Azure regions. Check their console for India availability.

#### Inferences
- More expensive than Upstash or ElastiCache for equivalent functionality.
- Redis Stack modules (JSON, Search, TimeSeries) are included, which could be useful for complex caching patterns.
- Not cost-effective for CasaFit's simple cache/queue needs.

#### Gaps
- Mumbai region availability and exact pricing not confirmed.
- Comparison with Upstash at CasaFit's expected scale not available.

---

### Upstash QStash (Serverless Queue)

#### Takeaway
QStash is a serverless HTTP-based message queue that pushes messages to your endpoints, eliminating the need for long-running consumers (like BullMQ workers). Pricing starts at $0 (1,000 messages/day free) with pay-as-you-go at $1 per 100K messages. Excellent for serverless architectures.

#### Cited Findings
- **Free tier:** $0/mo — 1,000 messages/day, 1 MB max message size, 50 GB bandwidth. — [Upstash QStash Pricing](https://upstash.com/pricing/qstash)
- **Pay-as-you-go:** $1 per 100K messages. Unlimited daily messages. 10 MB max message size. Bandwidth free up to 50 GB/month. Retries are not billed. Delays up to 1 year supported. — [Upstash QStash Pricing](https://upstash.com/pricing/qstash)
- **Fixed plans:** Fixed 1M at $180/mo (1M messages/day), Fixed 10M at $420/mo (10M messages/day). — [Upstash QStash Pricing](https://upstash.com/pricing/qstash)
- **Schedules:** First 1,000 active schedules free, then $0.01 each. — [Upstash QStash Pricing](https://upstash.com/pricing/qstash)
- **Dead-letter queue:** 7-day retention on pay-as-you-go, up to 3 months on Fixed 10M.
- **Upstash Workflow:** Built on QStash for multi-step durable workflows. Billed by QStash message consumption. — [Upstash Workflow Pricing](https://upstash.com/docs/workflow/pricing)

#### Inferences
- For CasaFit's background jobs (daily food/step sync, analytics flush), QStash's free tier (1,000 messages/day) may suffice initially.
- At scale: 10K daily sync jobs = 300K messages/month = $3/mo on pay-as-you-go. Very cheap.
- QStash pushes to HTTP endpoints, so it works perfectly with serverless (Supabase Edge Functions, Vercel Functions) or traditional servers (NestJS).
- Replaces BullMQ + Redis worker pattern with a simpler push-based model, eliminating the need for always-on worker processes.
- Scheduled messages (cron-like) are built-in, good for daily batch jobs.

#### Gaps
- Latency of message delivery from QStash to a Mumbai-hosted endpoint not measured.
- Comparison with Azure Service Bus pricing not researched in depth.

---

## Part 3: Supabase Deep Dive for CasaFit

### Can Supabase Replace the Entire Backend?

#### Takeaway
Supabase can replace large portions of a traditional backend (auth, database, storage, realtime subscriptions, simple API endpoints) but cannot fully replace a NestJS/Express server for complex business logic, heavy computation, or advanced queue processing due to edge function limitations.

#### Cited Findings
- **Auth:** Built-in auth supports email, phone (OTP via SMS/WhatsApp), social logins (Google, Apple, etc.), and magic links. Phone OTP requires an external SMS provider (Twilio, Twilio Verify). — [Supabase Auth Docs](https://supabase.com/docs/guides/auth/phone-login)
- **Database:** Full Postgres with extensions (PostGIS, pg_cron, pgvector, etc.). Row Level Security for data isolation. — [Supabase Docs](https://supabase.com/docs)
- **Storage:** Object storage for files (images, videos). Integrated with Auth for access control. Transformations (resize, crop) available. Free: 1 GB, Pro: 100 GB. — [Supabase Pricing](https://supabase.com/pricing)
- **Edge Functions:** Deno-based serverless functions. 256 MB RAM, 2s CPU limit. Good for webhooks, auth hooks, lightweight API logic. Not suitable for heavy computation. — [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- **Realtime:** Built-in websocket subscriptions for database changes, presence, and broadcast. Useful for live updates in the app.

#### Inferences
- **What Supabase can replace:**
  - User authentication (signup, login, OTP) — replaces custom auth module
  - Database CRUD via PostgREST auto-generated API — replaces simple REST controllers
  - File storage for workout videos, profile images — replaces S3 + custom upload logic
  - Realtime subscriptions for live workout sessions — replaces custom WebSocket server
  - Simple background triggers via database webhooks + edge functions — replaces some BullMQ jobs

- **What still needs a standalone backend (NestJS):**
  - Complex business logic (subscription management, payment processing)
  - Long-running background jobs (daily analytics aggregation, batch notifications)
  - Integration with external APIs requiring complex orchestration (HealthKit/Google Fit sync)
  - Advanced rate limiting and idempotency logic
  - Any computation exceeding 2s CPU or 256 MB RAM

- **Recommended hybrid architecture:**
  - Supabase: Auth + Database + Storage + Realtime + simple edge functions
  - NestJS: Complex business logic, payment webhooks, background jobs, external API integrations
  - Upstash Redis: OTP storage (if not using Supabase Auth), rate limiting, idempotency
  - Upstash QStash: Background job queue (replacing BullMQ)

### Supabase Auth vs Custom OTP for India

#### Takeaway
Supabase Auth supports phone OTP but requires an external SMS provider. For India, this means integrating Twilio or a custom provider. The 60-second OTP window may be too short for Indian network conditions. A custom OTP implementation via Upstash Redis (5-minute TTL) with MSG91 or Gupshup may be more appropriate.

#### Cited Findings
- **Supabase Auth phone OTP:** Uses `signInWithOtp({phone})` to send a 6-digit code. Must configure Twilio, Twilio Verify, or MessageBird as SMS provider. Code valid for 60 seconds by default. — [Supabase Phone Login Docs](https://supabase.com/docs/guides/auth/phone-login)
- **Custom provider support:** Supabase supports configuring custom SMS providers via webhooks, which could enable India-specific providers like MSG91. — [Supabase Self-Hosted Phone MFA Docs](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa)
- **India SMS landscape:** Indian regulations (TRAI DLT) require pre-registered sender IDs and templates. Twilio supports Indian DLT compliance. MSG91 and Gupshup are popular India-specific alternatives with lower per-SMS costs.

#### Inferences
- Supabase Auth phone OTP is usable for India but the 60-second window is aggressive. Most Indian apps use 5-10 minute OTP windows.
- If using Supabase Auth, you'd configure Twilio (supports DLT compliance) as the SMS provider. Cost: ~$0.04-0.08 per SMS to India via Twilio.
- A custom OTP system using MSG91 (~$0.01-0.02 per SMS) + Upstash Redis (5-min TTL) would be cheaper and more flexible, but requires building the auth flow yourself.
- Recommendation: Start with Supabase Auth for simplicity. If the 60-second window or SMS costs become issues, migrate to custom OTP later.

### Row Level Security for Multi-Tenant Data

#### Takeaway
RLS is Supabase's primary data isolation mechanism and works well for CasaFit's per-user data model. However, it requires careful policy design and testing, as misconfigured policies fail silently (either exposing data or blocking all access).

#### Cited Findings
- **How it works:** RLS policies filter rows based on `auth.uid()` (the authenticated user's ID). With RLS enabled and no policies defined, the table is completely inaccessible. — [Makerkit RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- **Row-level only:** RLS filters rows but cannot restrict specific columns. A user who passes the row policy can read/write all columns in that row. Column-level restrictions require views or security-definer functions. — [Supabase Security Audit consultant](https://contra.com/s/LUqQqQWU-postgres-and-supabase-security-audit-rls-billing)
- **Silent failures:** Missing `WITH CHECK` clauses, overly broad `FOR ALL` policies, or wrong column comparisons can silently expose data or block legitimate access. — [Various Supabase security discussions]
- **Performance:** Inline policies are recommended as a starting point. Use `EXPLAIN ANALYZE` to check for performance issues. Complex policies with JOINs can slow queries. — [Makerkit RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

#### Inferences
- For CasaFit's data model (each user sees only their own food entries, step summaries, session logs), RLS policies are straightforward: `auth.uid() = user_id` on each table.
- Subscription/entitlement data requires more careful policies (e.g., admin access to modify plans).
- Test RLS policies thoroughly. Consider a security audit before launch.
- The anon key ships in the mobile app binary and is publicly visible. All security must rely on RLS policies, not on key secrecy.

### Pricing at Scale

#### Takeaway
Supabase Pro at $25/mo is excellent for 0-50K users. At 100K+ MAUs, costs increase primarily through MAU overage ($0.00325/MAU) and compute scaling. A 500K MAU app could cost $1,500-2,500/mo on Supabase, which is still competitive with building equivalent infrastructure from scratch.

#### Cited Findings
- **Pro base:** $25/mo includes 100K MAUs, 8 GB disk, 100 GB storage, Micro compute. — [Supabase Pricing](https://supabase.com/pricing)
- **MAU overage:** $0.00325 per MAU beyond 100K. At 500K MAUs: 400K * $0.00325 = $1,300/mo in MAU overage alone. — [Supabase Pricing](https://supabase.com/pricing)
- **Compute scaling:** Medium ($60/mo) or Large ($110/mo) compute likely needed at 100K+ concurrent connections. — [Supabase Pricing](https://supabase.com/pricing)
- **Storage overage:** $0.0213/GB beyond 100 GB. At 500 GB (workout videos): ~$8.52/mo overage. — [Supabase Pricing](https://supabase.com/pricing)

#### Inferences
- **0-10K users:** Free tier may suffice ($0/mo), but projects pause after 1 week of inactivity.
- **10K-100K users:** Pro at $25/mo + ~$0-15/mo in minor overages = $25-40/mo.
- **100K-500K users:** Pro at $25/mo + $1,300/mo MAU overage + $60-110/mo compute + storage = ~$1,500-1,500/mo.
- **At high scale:** Team tier ($599/mo base) may be more economical than Pro with heavy overages, due to volume discounts and SLA guarantees.
- **Comparison:** Building equivalent infrastructure (RDS + ElastiCache + S3 + Cognito + API Gateway + CloudFront) on AWS would cost $200-500/mo at 100K users but requires significantly more engineering effort.

### Limitations and Gotchas for Mobile App Backend

#### Inferences (based on accumulated research)
1. **Anon key exposure:** The Supabase anon key is embedded in the mobile app and is publicly visible. All security MUST rely on RLS policies.
2. **Edge function cold starts:** Deno-based functions may have cold starts, adding latency to the first request after idle. Not well-documented for Mumbai region.
3. **60-second OTP window:** Too short for many Indian users on slow networks. Custom OTP may be needed.
4. **No offline sync:** Supabase has no built-in offline-first capability. For a workout app that may be used without connectivity, you need client-side caching and sync logic.
5. **Vendor lock-in:** While Postgres is portable, Supabase Auth, Storage, and Edge Functions are proprietary. Migrating away requires replacing these components.
6. **Connection limits:** Free tier has limited connections. Pro's Micro compute (1 GB RAM) supports a limited connection pool. Mobile apps with many concurrent users will need connection pooling (Supavisor is built-in).
7. **Project pausing:** Free tier projects pause after 1 week of inactivity. Not suitable for production.
8. **Bandwidth costs:** 250 GB egress on Pro. Streaming workout videos through Supabase Storage could consume this quickly. Consider a CDN or separate video hosting.

---

## Summary Comparison Table

### Databases

| Service | Mumbai Region | Monthly Cost (small) | Free Tier | Best For |
|---------|--------------|---------------------|-----------|----------|
| **Supabase** | Yes (Nov 2025, unverified) | $25/mo (Pro, all-in-one) | Yes (500 MB, pauses) | All-in-one BaaS, rapid MVP |
| **AWS RDS** | Yes (ap-south-1) | $18/mo (t4g.micro + 20GB) | 12-month trial only | Full control, AWS ecosystem |
| **Azure Flexible** | Yes (Central India) | ~$19/mo (B1ms + 32GB, est.) | No | Azure ecosystem |
| **Neon** | Unconfirmed | $0-19/mo | Yes (0.5 GB) | Scale-to-zero, dev/test |
| **PlanetScale** | Unconfirmed | ~$5-39/mo | No | MySQL workloads (not recommended) |
| **Cloud SQL** | Yes (asia-south1) | ~$35-50/mo (est.) | No | GCP ecosystem |
| **CockroachDB** | Unconfirmed | $0 (free allotment) | Yes (50M RUs) | Distributed SQL (overkill) |

### Cache/Queue

| Service | Mumbai Region | Monthly Cost | Free Tier | Best For |
|---------|--------------|-------------|-----------|----------|
| **Upstash Redis** | Yes (ap-south-1, unverified) | $0-5/mo (low traffic) | Yes (500K cmds) | Serverless, startup-friendly |
| **AWS ElastiCache** | Yes (ap-south-1) | ~$14-16/mo | No | Dedicated perf, AWS VPC |
| **Azure Cache** | Yes (Central India) | ~$16-40/mo | No | Azure ecosystem |
| **Dragonfly** | Self-hosted anywhere | ~$10/mo (VM cost) | N/A (OSS) | Self-hosted, high perf |
| **Redis Cloud** | Unconfirmed | ~$5-50+/mo | Yes (30 MB) | Redis modules |
| **Upstash QStash** | Global (push-based) | $0-3/mo (low traffic) | Yes (1K msgs/day) | Serverless queues |

### Recommended Stack for CasaFit (Startup Phase)

**Option A — Supabase-First (Fastest to market, ~$25-35/mo):**
- Supabase Pro ($25/mo): Auth + Database + Storage + Edge Functions
- Upstash Redis (Free-$5/mo): OTP codes, rate limiting, idempotency
- Upstash QStash (Free-$3/mo): Background jobs
- NestJS backend (only for complex logic): Deployed on Railway/Render/EC2

**Option B — AWS-Native (More control, ~$40-60/mo):**
- AWS RDS t4g.micro ($15/mo): PostgreSQL database
- AWS ElastiCache t4g.micro ($14/mo): Redis cache
- NestJS on EC2/ECS/Fargate: Full backend with BullMQ for queues
- AWS S3 + CloudFront: Storage and CDN
- Custom auth with MSG91 + Redis OTP

**Option C — Hybrid (Best of both, ~$30-45/mo):**
- Supabase Pro ($25/mo): Database + Storage + Realtime
- Custom NestJS backend: Auth (with MSG91 OTP), business logic, background jobs
- Upstash Redis ($0-5/mo): OTP, rate limiting, session cache
- Upstash QStash ($0-3/mo): Background job queue
