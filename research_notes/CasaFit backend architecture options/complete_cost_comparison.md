# CasaFit Infrastructure Cost Comparison

## Complete Three-Stack Analysis for a 15-Minute Home Workout App (India Market)

**Last updated:** October 2026 (pricing verified against 2025-2026 published rates)
**Currency:** All prices in USD/month unless noted

> **Important:** All estimates use publicly available pricing. Actual costs depend on usage patterns, negotiated rates, and reserved-instance commitments. Always verify with each provider's pricing calculator before committing.

---

## Table of Contents

1. [Component-by-Component Breakdown](#component-by-component-breakdown)
2. [Summary Comparison Tables](#summary-comparison-tables)
3. [Strategic Analysis](#strategic-analysis)
4. [Hidden Costs & Gotchas](#hidden-costs--gotchas)
5. [Recommendations](#recommendations)
6. [Sources](#sources)

---

## Component-by-Component Breakdown

### 1. Backend API (Compute)

#### Stack A: Azure App Service

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Free (F1) | $0 | 60 min/day compute, 1 GB RAM, no custom domain SSL, no SLA |
| Growth | Basic (B1) | ~$13 | 1 core, 1.75 GB RAM, Central India region |
| Scale | Standard (S2) | ~$100 | 2 cores, 3.5 GB RAM, auto-scale, staging slots |

- **India availability:** Central India (Pune), South India (Chennai), West India (Mumbai). All three regions available.
- **Free tier:** F1 is severely limited (60 CPU min/day, always-on not supported). Realistically need B1 ($13/mo) for any production use.
- Source: [Azure App Service Pricing](https://azure.microsoft.com/en-in/pricing/details/app-service/)

#### Stack B: AWS Fargate / App Runner

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | App Runner (minimal) | ~$5-7 | 0.25 vCPU, 0.5 GB, scales to zero when idle |
| Growth | Fargate (1 task) | ~$25 | 0.5 vCPU, 1 GB RAM, always-on |
| Scale | Fargate (2 tasks + ALB) | ~$70-90 | 1 vCPU, 2 GB RAM each, load balanced |

- **India availability:** Mumbai (ap-south-1) and Hyderabad (ap-south-2). Full Fargate and App Runner support.
- **Free tier:** No persistent free tier for Fargate. App Runner has no free tier but scales to near-zero when idle.
- **Fargate pricing (Mumbai):** ~$0.04048/vCPU-hour + ~$0.004445/GB-hour
- Source: [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)

#### Stack C: Railway or Render

**Railway:**

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Hobby | ~$5 | $5/mo includes $5 usage credit; small container ~0.5 vCPU |
| Growth | Pro | ~$25-30 | $20/mo seat + ~$10 compute (0.5 vCPU, 1 GB RAM) |
| Scale | Pro | ~$60-80 | $20/mo seat + ~$40-60 compute (1-2 vCPU, 2-4 GB RAM) |

- **Compute rates:** $20/vCPU/month, $10/GB RAM/month, $0.05/GB egress
- Source: [Railway Pricing](https://docs.railway.com/pricing/plans)

**Render:**

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Free | $0 | 0.1 CPU, 512 MB; spins down after 15 min inactivity |
| Growth | Starter | $7 | 0.5 CPU, 512 MB; always-on, no spin-down |
| Scale | Standard | $25 | 1 CPU, 2 GB RAM |

- **India availability:** Railway and Render do NOT have India regions. Closest is Singapore. This is a significant drawback for data residency requirements.
- Source: [Render Pricing](https://render.com/pricing)

---

### 2. Database (PostgreSQL)

#### Stack A: Azure Database for PostgreSQL Flexible Server

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Burstable B1ms | ~$12-15 | 1 vCPU, 2 GB RAM, 32 GB storage |
| Growth | Burstable B2s | ~$25-30 | 2 vCPU, 4 GB RAM, 64 GB storage |
| Scale | GP D2ds_v5 | ~$130-150 | 2 vCPU, 8 GB RAM, 128 GB storage, HA available |

- **Storage:** ~$0.115/GB/month (General Purpose SSD), billed separately
- **India availability:** Central India, South India
- Source: [Bytebase Azure Flexible Server Pricing](https://www.bytebase.com/dbcost/azure-flexible-server-pricing/)

#### Stack B: AWS RDS PostgreSQL

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | db.t3.micro | ~$12-15 | 1 vCPU, 1 GB RAM, 20 GB storage; free tier for 12 months |
| Growth | db.t3.small | ~$25-30 | 2 vCPU, 2 GB RAM, 50 GB storage |
| Scale | db.r6g.large | ~$120-150 | 2 vCPU, 16 GB RAM, 100 GB storage, Multi-AZ |

- **Free tier:** 750 hours/month of db.t3.micro for 12 months (new accounts only)
- **Storage:** ~$0.133/GB/month (gp3) in Mumbai
- **India availability:** Mumbai (ap-south-1), Hyderabad (ap-south-2)
- Source: [AWS RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/)

#### Stack C: Supabase

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Free | $0 | 500 MB database, 50K MAU auth, 1 GB file storage, 2 projects |
| Growth | Pro | $25 | 8 GB database, 100K MAU, 100 GB file storage, 250 GB bandwidth |
| Scale | Pro + compute add-on | $75-150 | 8 GB+ database, dedicated compute from $50/mo additional |

- **Free tier limits:** Pauses after 1 week inactivity; 2 active projects max; 5 GB bandwidth
- **India availability:** Supabase offers Mumbai (ap-south-1) region on AWS infrastructure for Pro plans and above. Free tier region selection may be limited.
- Source: [Supabase Pricing](https://supabase.com/pricing)

---

### 3. Cache (Redis)

#### Stack A: Azure Cache for Redis

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Basic C0 (250 MB) | ~$17 | No SLA, single node, dev/test only |
| Growth | Basic C1 (1 GB) | ~$40 | No SLA, single node |
| Scale | Standard C1 (1 GB) | ~$52 | SLA, replicated |

- **No free tier** for Azure Cache for Redis
- **Note:** Azure Cache for Redis is being retired September 2028; Microsoft recommends Azure Managed Redis for new deployments
- **India availability:** Central India
- Source: [Azure Cache for Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)

#### Stack B: AWS ElastiCache Redis

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | cache.t3.micro | ~$10-12 | 0.5 GB; free tier 750 hrs/mo for 12 months |
| Growth | cache.t3.small | ~$20-25 | 1.37 GB |
| Scale | cache.r6g.large | ~$80-100 | 13.07 GB, production-grade |

- **Free tier:** 750 hours/month of cache.t3.micro for 12 months (new accounts only)
- **India availability:** Mumbai (ap-south-1)
- Source: [AWS ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)

#### Stack C: Upstash Redis

| Tier | Plan | Monthly Cost | Notes |
|------|------|-------------|-------|
| Launch | Free | $0 | 256 MB, 500K commands/month, 10 GB bandwidth |
| Growth | Pay-as-you-go | ~$3-8 | $0.20/100K commands + $0.25/GB storage (1 GB free) |
| Scale | Fixed 250 MB | $10 | 50 GB bandwidth, 10K max cmd/sec |

- **Free tier:** Generous for a small app; 500K commands/month, no credit card required
- **India availability:** Upstash has a global edge network but may not have a dedicated Mumbai region. Verify latency.
- Source: [Upstash Redis Pricing](https://upstash.com/pricing/redis)

---

### 4. Object Storage + CDN (Workout Videos)

#### Stack A: Azure Blob Storage + Azure CDN / Front Door

| Tier | Storage (50 GB) | CDN (100 GB/mo) | Monthly Cost | Notes |
|------|-----------------|-----------------|-------------|-------|
| Launch | ~$1 | ~$5 | ~$6 | Hot tier, minimal traffic |
| Growth | ~$5 (250 GB) | ~$12 | ~$17 | Moderate video streaming |
| Scale | ~$10 (500 GB) | ~$55 | ~$65 | 500 GB CDN delivery |

- **Blob Storage (Hot, India):** ~$0.02/GB/month (approximately INR 1.60/GB)
- **Azure Front Door (India zone):** ~$0.109/GB for first 10 TB + $35/mo base fee (Standard)
- **Note:** Classic Azure CDN is being retired; use Front Door for new projects
- **India availability:** Central India, South India, West India
- Source: [Azure Front Door Pricing](https://azure.microsoft.com/en-ca/pricing/details/frontdoor)

#### Stack B: AWS S3 + CloudFront

| Tier | Storage (50 GB) | CDN (100 GB/mo) | Monthly Cost | Notes |
|------|-----------------|-----------------|-------------|-------|
| Launch | ~$1 | ~$0 | ~$1 | S3 standard + CloudFront free tier (1 TB/mo) |
| Growth | ~$6 (250 GB) | ~$0 | ~$6 | Still within CloudFront free tier |
| Scale | ~$12 (500 GB) | ~$46 | ~$58 | 500 GB delivery @ ~$0.092/GB India |

- **S3 (Mumbai):** ~$0.025/GB/month (Standard), $0.005/GB PUT requests
- **CloudFront free tier:** 1 TB data transfer out per month (always free, not just 12 months)
- **CloudFront India rate:** ~$0.092/GB (first 10 TB) - cheaper than Azure
- **India availability:** Mumbai (ap-south-1), CloudFront has India edge locations
- Source: [AWS CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)

#### Stack C: Cloudflare R2 + Cloudflare CDN

| Tier | Storage (50 GB) | CDN | Monthly Cost | Notes |
|------|-----------------|-----|-------------|-------|
| Launch | ~$0 | $0 | $0 | Within 10 GB free tier |
| Growth | ~$4 (250 GB) | $0 | ~$4 | Zero egress fees |
| Scale | ~$7.50 (500 GB) | $0 | ~$7.50 | Zero egress fees |

- **R2 Free tier:** 10 GB storage, 1M Class A ops, 10M Class B ops per month
- **R2 Paid:** $0.015/GB/month storage, $4.50/million Class A, $0.36/million Class B
- **Egress:** ZERO bandwidth charges (massive advantage for video-heavy app)
- **India availability:** Cloudflare has extensive India edge presence; R2 storage is geo-distributed
- Source: [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing)

---

### 5. SMS OTP (India)

#### Stack A: Azure Communication Services

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| All tiers | **NOT AVAILABLE** | Azure Communication Services does not support SMS to India |

- **Alternative for Stack A:** Must use MSG91 or similar Indian SMS provider
- Source: [Microsoft Q&A - India SMS not supported](https://learn.microsoft.com/en-us/answers/questions/2124468/azure-sms-services-for-india-region)

#### All Stacks: MSG91 (Recommended for India)

| Tier | Volume | Monthly Cost | Notes |
|------|--------|-------------|-------|
| Launch | ~500 OTPs/mo | ~$1-2 | ~INR 0.15-0.20/OTP |
| Growth | ~5,000 OTPs/mo | ~$10-12 | Volume discounts apply |
| Scale | ~50,000 OTPs/mo | ~$80-100 | ~INR 0.13-0.15/OTP at volume |

- **Per-OTP cost:** INR 0.15-0.25 (approximately $0.002-0.003) depending on volume and plan
- **DLT registration:** Required for SMS in India; one-time setup with TRAI-compliant template registration
- **Alternatives:** Gupshup, Kaleyra, Twilio (more expensive for India)
- Source: [MSG91 OTP Pricing](https://msg91.com/in/pricing/otpwidget); [Authgear OTP Comparison](https://www.authgear.com/post/best-otp-service-providers/)

---

### 6. Push Notifications

#### Stack A: Azure Notification Hubs

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| Launch | $0 | Free tier: 1M pushes/subscription, 500 device limit per namespace |
| Growth | $10 | Basic: unlimited pushes, higher device limits |
| Scale | $200 | Standard: rich push, scheduled push, telemetry |

- Source: [Azure Notification Hubs Pricing](https://azure.microsoft.com/en-us/pricing/details/notification-hubs/)

#### Stack B & C: Firebase Cloud Messaging (FCM)

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| All tiers | $0 | FCM is completely free, unlimited push notifications |

- **No cost** at any scale for basic push
- Requires Firebase project setup; Google's infrastructure
- Source: Firebase is free for push notifications with no per-message charges

---

### 7. Subscription Billing: RevenueCat (All Stacks)

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| Launch | $0 | Free up to $2,500/mo MTR (Monthly Tracked Revenue) |
| Growth | ~$50-100 | 1% of MTR above $2,500 |
| Scale | ~$200-500+ | 1% of MTR; grows with revenue |

- **Free tier:** Full product access up to $2,500 MTR; no credit card required initially
- **Note:** 1% is on GROSS revenue (before Apple/Google 15-30% commission), so effective rate is ~1.2-1.4% of net revenue
- **Webhooks:** Server-side webhooks require paid Pro plan (>$2,500 MTR)
- Source: [RevenueCat Pricing](https://www.revenuecat.com/pricing/); [CostBench RevenueCat](https://costbench.com/software/subscription-billing/revenuecat/)

---

### 8. Error Monitoring

#### Stack A: Azure Application Insights

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| Launch | $0 | 5 GB/month free ingestion across billing account |
| Growth | $0-5 | Likely within free tier for small app |
| Scale | ~$23-50 | $2.30/GB ingestion above 5 GB free |

- **Free tier:** 5 GB/month data ingestion, 90-day retention for App Insights data
- Source: [Azure Monitor Pricing](https://azure.microsoft.com/en-us/pricing/details/monitor/)

#### Stack B & C: Sentry

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| Launch | $0 | Developer plan: 5K errors/month, 1 user |
| Growth | $0-26 | May still fit free tier; Team at $26/mo for 50K errors |
| Scale | $26-89 | Team ($26/mo) or Business ($89/mo) for 100K+ errors |

- **Free tier:** 5K errors, 10M spans, 50 session replays per month
- **Self-hosting:** Available as cost-saving option at scale
- Source: [Sentry Pricing](https://sentry.io/pricing/); [Last9 Sentry Pricing Guide](https://last9.io/blog/sentry-pricing/)

---

### 9. Analytics

#### All Stacks: PostHog Cloud

| Tier | Monthly Cost | Notes |
|------|-------------|-------|
| Launch | $0 | 1M events/month, 5K session recordings, 1M feature flag requests |
| Growth | $0-20 | Likely within free tier for 10K users |
| Scale | $50-150 | Pay-per-event above free tier |

- **Free tier:** Very generous; 1M events/month covers most startups through growth stage
- **Billing controls:** Can set spending limits per product
- Source: [PostHog Pricing](https://posthog.com/pricing)

---

## Summary Comparison Tables

### Launch Tier (0-1K Users) - Monthly Cost

| Component | Stack A (Azure) | Stack B (AWS) | Stack C (Budget) |
|-----------|----------------|---------------|------------------|
| **API Compute** | $0 (F1 Free)* | $5-7 (App Runner) | $0-5 (Render Free / Railway Hobby) |
| **PostgreSQL** | $12-15 (B1ms) | $0** (db.t3.micro free tier) | $0 (Supabase Free) |
| **Redis Cache** | $17 (Basic C0) | $0** (cache.t3.micro free tier) | $0 (Upstash Free) |
| **Storage + CDN** | $6 | $1 | $0 (R2 Free) |
| **SMS OTP** | $2 (MSG91) | $2 (MSG91) | $2 (MSG91) |
| **Push Notifications** | $0 (NH Free) | $0 (FCM) | $0 (FCM) |
| **Billing** | $0 (RevenueCat) | $0 (RevenueCat) | $0 (RevenueCat) |
| **Monitoring** | $0 (App Insights) | $0 (Sentry Free) | $0 (Sentry Free) |
| **Analytics** | $0 (PostHog) | $0 (PostHog) | $0 (PostHog) |
| **TOTAL** | **~$37-40** | **~$8-10** | **~$2-7** |

*Azure F1 is barely usable for production (60 min/day CPU)
**AWS free tier expires after 12 months; plan for $25-40/mo after that

### Growth Tier (1K-10K Users) - Monthly Cost

| Component | Stack A (Azure) | Stack B (AWS) | Stack C (Budget) |
|-----------|----------------|---------------|------------------|
| **API Compute** | $13 (B1) | $25 (Fargate) | $7-30 (Render Starter / Railway Pro) |
| **PostgreSQL** | $25-30 (B2s) | $25-30 (db.t3.small) | $25 (Supabase Pro) |
| **Redis Cache** | $40 (Basic C1) | $20-25 (cache.t3.small) | $3-10 (Upstash PAYG/Fixed) |
| **Storage + CDN** | $17 | $6 | $4 (R2) |
| **SMS OTP** | $10-12 (MSG91) | $10-12 (MSG91) | $10-12 (MSG91) |
| **Push Notifications** | $10 (NH Basic) | $0 (FCM) | $0 (FCM) |
| **Billing** | $50-100 (RC) | $50-100 (RC) | $50-100 (RC) |
| **Monitoring** | $0 (App Insights) | $0-26 (Sentry) | $0-26 (Sentry) |
| **Analytics** | $0 (PostHog) | $0 (PostHog) | $0 (PostHog) |
| **TOTAL** | **~$165-222** | **~$136-199** | **~$99-182** |

### Scale Tier (10K-100K Users) - Monthly Cost

| Component | Stack A (Azure) | Stack B (AWS) | Stack C (Budget) |
|-----------|----------------|---------------|------------------|
| **API Compute** | $100 (S2) | $70-90 (Fargate x2) | $25-80 (Render Standard / Railway Pro) |
| **PostgreSQL** | $130-150 (GP D2ds) | $120-150 (db.r6g.large) | $75-150 (Supabase Pro + compute) |
| **Redis Cache** | $52 (Standard C1) | $80-100 (cache.r6g.large) | $10-30 (Upstash Fixed) |
| **Storage + CDN** | $65 | $58 | $7.50 (R2, zero egress) |
| **SMS OTP** | $80-100 (MSG91) | $80-100 (MSG91) | $80-100 (MSG91) |
| **Push Notifications** | $10-200 (NH) | $0 (FCM) | $0 (FCM) |
| **Billing** | $200-500 (RC) | $200-500 (RC) | $200-500 (RC) |
| **Monitoring** | $23-50 (AI) | $26-89 (Sentry) | $26-89 (Sentry) |
| **Analytics** | $50-150 (PostHog) | $50-150 (PostHog) | $50-150 (PostHog) |
| **TOTAL** | **~$710-1,365** | **~$684-1,179** | **~$473-1,099** |

### Grand Summary

| Metric | Stack A (Azure) | Stack B (AWS) | Stack C (Budget) |
|--------|----------------|---------------|------------------|
| **Launch** | ~$37-40/mo | ~$8-10/mo | ~$2-7/mo |
| **Growth** | ~$165-222/mo | ~$136-199/mo | ~$99-182/mo |
| **Scale** | ~$710-1,365/mo | ~$684-1,179/mo | ~$473-1,099/mo |
| **India Region** | Yes (3 regions) | Yes (2 regions) | Partial (Supabase: yes; Render/Railway: no) |
| **Free Tier Quality** | Weak | Good (12-mo only) | Best (permanent free tiers) |

---

## Strategic Analysis

### Which stack is easiest for a small team (1-2 developers)?

**Winner: Stack C (Budget/Startup Stack)**

- **Supabase** provides database + auth + storage + real-time in one platform, eliminating the need to configure and manage separate services. Built-in auth with email, phone, and social login reduces weeks of development work.
- **Railway/Render** offer simple git-push deployments with zero DevOps overhead. No Kubernetes, no container orchestration, no IAM policies to configure.
- **Upstash** is serverless Redis with zero management. No instance sizing, no patching, no monitoring of Redis health.
- **Cloudflare R2** has zero-config CDN with no origin-pull setup, no cache invalidation complexity.
- Total number of dashboards/consoles to manage: ~4-5 vs. 8-10 for Azure/AWS.

**Stack A (Azure)** is moderate difficulty. Azure Portal is complex but well-documented. .NET tooling with Visual Studio integration is excellent.

**Stack B (AWS)** has the steepest learning curve. IAM, VPC configuration, security groups, and the sheer number of services require significant AWS knowledge. Not recommended without prior AWS experience.

### Which scales most cost-effectively?

**At Scale (10K-100K users): Stack C wins on raw cost, but AWS wins on capability.**

- **Stack C** saves $200-300/mo vs. AWS/Azure at scale, primarily from Cloudflare R2's zero egress fees. For a video-heavy fitness app, CDN/storage bandwidth is the largest variable cost. R2's zero egress is a massive advantage.
- **Stack B (AWS)** offers the deepest scaling options: auto-scaling groups, spot instances, reserved instances (30-40% savings), and the broadest India infrastructure.
- **Stack A (Azure)** is the most expensive at all tiers, primarily due to Azure Cache for Redis and Azure Notification Hubs costs.

**Key insight:** At 100K users streaming workout videos, CDN bandwidth becomes the dominant cost. Cloudflare R2's zero egress could save $500-1,000+/month compared to S3+CloudFront or Azure Blob+CDN.

### Which has the best India region support?

**Winner: Stack B (AWS)**

| Provider | India Regions | Data Residency | Notes |
|----------|--------------|----------------|-------|
| **AWS** | Mumbai, Hyderabad | Full | Most services available in both regions |
| **Azure** | Pune, Chennai, Mumbai | Full | Good coverage; some services limited to Central India |
| **Supabase** | Mumbai (on AWS) | Yes (Pro plan) | Database in Mumbai; free tier may be limited |
| **Railway** | None | NO | Closest: Singapore. **Fails data residency requirement** |
| **Render** | None | NO | Closest: Singapore. **Fails data residency requirement** |
| **Cloudflare R2** | Distributed | Partial | Data at nearest edge; no region pinning guarantee |
| **Upstash** | Global edge | Partial | May not guarantee India-only data storage |

**Critical finding:** Railway and Render do NOT have India regions. If India data residency is a hard requirement, Stack C cannot use Railway or Render for the API layer. You would need to:
- Use a VPS in Mumbai (DigitalOcean, Hetzner) instead
- Or deploy to Supabase Edge Functions for the API
- Or use Railway/Render only for non-data-resident services

---

## Hidden Costs & Gotchas

### Data Transfer Costs (The Silent Killer)

| Provider | Egress Cost (India) | Free Allowance | Impact on Video App |
|----------|-------------------|----------------|---------------------|
| **Azure** | ~$0.109/GB (Front Door India) | Minimal | 1 TB video delivery = ~$109/mo |
| **AWS CloudFront** | ~$0.092/GB (India) | 1 TB/mo free (always) | 1 TB video delivery = ~$0/mo (free tier) |
| **Cloudflare R2** | $0/GB | Unlimited | 1 TB video delivery = $0/mo |
| **Supabase** | $0.09/GB beyond 250 GB (Pro) | 250 GB (Pro) | Mainly for API/DB traffic |

For a workout app with 100K users each streaming ~200 MB of video/month = ~20 TB/month:
- **Azure CDN:** ~$1,700/mo
- **AWS CloudFront:** ~$1,748/mo (above 1 TB free)
- **Cloudflare:** $0/mo

### Other Hidden Costs

1. **Azure:**
   - Application Gateway / Load Balancer: $18-25/mo minimum if needed
   - Azure Monitor/Log Analytics: charges per GB ingested beyond free tier
   - IP addresses: static IPs cost ~$4/mo each
   - Azure Notification Hubs: $200/mo jump from Basic to Standard

2. **AWS:**
   - NAT Gateway: $32/mo + $0.045/GB if using private subnets (common pattern)
   - RDS storage IOPS: can add 20-30% to database costs
   - Secrets Manager: $0.40/secret/month
   - 12-month free tier cliff: budget jumps $40-60/mo when free tier expires

3. **Stack C:**
   - Render workspace fees: $19-29/user/month on team plans
   - Supabase Pro: $25/mo minimum per project, even if barely used
   - Supabase pause policy: free tier projects pause after 1 week of inactivity
   - Railway egress: $0.05/GB adds up for API responses

4. **All Stacks:**
   - RevenueCat 1% fee: applied to gross revenue, not net after store commission
   - MSG91 DLT registration: mandatory for India SMS; one-time setup effort, not cost
   - PostHog: generous free tier but costs scale rapidly above 1M events; set billing caps
   - SSL certificates: free everywhere (Let's Encrypt / managed), but custom domains may cost extra on some platforms

### Apple/Google Store Fees (Not Infrastructure, But Significant)

- Apple: 15% (first $1M/year via Small Business Program) or 30%
- Google: 15% (first $1M/year) or 30%
- These dwarf infrastructure costs for most apps

---

## Recommendations

### For CasaFit Specifically

**Recommended Approach: Hybrid Stack C + AWS**

Given that CasaFit is a video-heavy Indian fitness app with strict data residency requirements:

1. **API:** Deploy NestJS on **AWS App Runner** (Mumbai) - simple deployment, scales to near-zero, India data residency
2. **Database:** **Supabase Pro** (Mumbai region) - includes auth, database, and file storage in one service; reduces development time significantly
3. **Cache:** **Upstash Redis** - serverless, free tier sufficient for launch, minimal management
4. **Video Storage + CDN:** **Cloudflare R2 + Cloudflare CDN** - zero egress is essential for a video app; saves hundreds to thousands per month at scale
5. **SMS OTP:** **MSG91** - best India rates, native DLT compliance
6. **Push:** **FCM** - free, reliable, no reason to pay for Azure Notification Hubs
7. **Billing:** **RevenueCat** - free until $2,500 MTR, industry standard
8. **Monitoring:** **Sentry** free tier - sufficient through growth stage
9. **Analytics:** **PostHog** free tier - 1M events covers through growth stage

**Estimated monthly costs with this hybrid approach:**
- Launch (0-1K users): **~$5-10/mo**
- Growth (1K-10K users): **~$70-120/mo**
- Scale (10K-100K users): **~$300-600/mo** (excluding RevenueCat, which scales with revenue)

This is roughly 40-60% cheaper than a full Azure stack and 30-50% cheaper than full AWS, while meeting India data residency requirements for the database and API.

### Migration Path

1. **Launch:** Start with Supabase Free + Render Free + Upstash Free + R2 Free = ~$2-5/mo
2. **When free tiers are outgrown:** Move API to AWS App Runner Mumbai, upgrade Supabase to Pro (Mumbai), keep R2 = ~$50-70/mo
3. **At scale:** Consider migrating database to RDS if Supabase limits become constraining; keep R2 for CDN; add Fargate for more compute control

---

## Sources

### Official Pricing Pages
- [Azure App Service Pricing](https://azure.microsoft.com/en-in/pricing/details/app-service/)
- [Azure Cache for Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)
- [Azure Front Door Pricing](https://azure.microsoft.com/en-ca/pricing/details/frontdoor)
- [Azure Notification Hubs Pricing](https://azure.microsoft.com/en-us/pricing/details/notification-hubs/)
- [AWS RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [AWS ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
- [AWS CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
- [Supabase Pricing](https://supabase.com/pricing)
- [Railway Pricing Plans](https://docs.railway.com/pricing/plans)
- [Render Pricing](https://render.com/pricing)
- [Upstash Redis Pricing](https://upstash.com/pricing/redis)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing)
- [PostHog Pricing](https://posthog.com/pricing)
- [Sentry Pricing](https://sentry.io/pricing/)
- [RevenueCat Pricing](https://www.revenuecat.com/pricing/)
- [MSG91 OTP Pricing](https://msg91.com/in/pricing/otpwidget)

### Third-Party Analysis & Comparisons
- [Bytebase Azure Flexible Server Pricing](https://www.bytebase.com/dbcost/azure-flexible-server-pricing/)
- [Last9 Sentry Pricing Guide](https://last9.io/blog/sentry-pricing/)
- [Authgear OTP Provider Comparison](https://www.authgear.com/post/best-otp-service-providers/)
- [Railway vs Render Comparison](https://agentdeals.dev/railway-vs-render)
- [Cloudchipr ElastiCache Pricing Guide](https://cloudchipr.com/blog/amazon-elasticache-pricing)
- [DragonflyDB Azure Redis Pricing Guide](https://www.dragonflydb.io/guides/azure-redis-pricing)

### India-Specific Sources
- [Azure SMS India Not Supported](https://learn.microsoft.com/en-us/answers/questions/2124468/azure-sms-services-for-india-region)
- [Azure India Regions](https://opsiocloud.com/in/knowledge-base/is-azure-available-in-india/)
- [AWS India Regions - PrecisionTech](https://precisiontech.in/cloud/amazon-aws-cloud/aws-pricing/aws-pricing-in-mumbai/)

---

*Note: All prices are estimates based on publicly available pricing as of late 2025 / early 2026. Prices vary by exact usage patterns, reserved commitments, and negotiated enterprise agreements. Always use the provider's pricing calculator for precise estimates before committing.*
