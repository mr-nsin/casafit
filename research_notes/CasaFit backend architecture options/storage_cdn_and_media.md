# CasaFit Storage, CDN & Media Delivery Research

> Research conducted October 2026. Pricing verified against official sources where possible; third-party figures are flagged.
> Scenario: 50 GB storage, 500 GB/month egress, India-focused delivery, short exercise demo videos (10-30s).

---

## Part 1: Object Storage Options

### AWS S3 — Mumbai (ap-south-1)

#### Takeaway
S3 Mumbai is the most mature India-resident option with the richest ecosystem, but its egress fees are the highest of any provider studied. It is best paired with CloudFront to reduce effective egress cost.

#### Cited Findings
- S3 Standard storage in Mumbai: **$0.025/GB-month** for the first 50 TB — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- S3 Standard-IA storage in Mumbai: approximately $0.0125/GB-month (roughly half of Standard) — [AWS Partner India pricing guide](https://precisiontech.in/cloud/amazon-aws-cloud/aws-pricing/)
- S3 Intelligent-Tiering: same storage rate as Standard for frequently accessed data, automatically moves infrequently accessed objects to a lower tier at no retrieval fee — [AWS S3 pricing page](https://aws.amazon.com/s3/pricing/)
- Internet egress from Mumbai: **$0.1093/GB** for the first 10 TB/month, dropping to $0.085/GB for 10-50 TB — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- First 100 GB/month of egress is free (aggregated across all AWS services and regions) — [AWS S3 pricing page](https://aws.amazon.com/s3/pricing/)
- Free tier for new accounts: up to $200 in credits valid for 6 months (as of July 2025) — [AWS S3 pricing page](https://aws.amazon.com/s3/pricing/)
- Signed URL support: yes, S3 presigned URLs with expiry are a core feature — [AWS documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage (Standard) | 50 GB x $0.025 | $1.25 |
| Egress (first 100 GB free) | 400 GB x $0.1093 | $43.72 |
| **Total** | | **~$44.97** |

#### Inferences
- S3 alone is expensive for a bandwidth-heavy app. Pairing with CloudFront reduces the effective per-GB egress cost significantly.
- Intelligent-Tiering is ideal for workout content: popular exercises stay in Standard; rarely-used demos auto-move to IA without manual lifecycle rules.
- The 100 GB free egress helps at very early stage but becomes negligible at scale.

---

### Cloudflare R2

#### Takeaway
R2's zero-egress model makes it the cheapest option for bandwidth-heavy workloads. The main trade-off is that R2 has no India-resident storage region yet — the nearest hint is "apac" (likely Singapore), adding ~80-120 ms origin latency. This matters less when a CDN cache sits in front.

#### Cited Findings
- R2 Standard storage: **$0.015/GB-month** — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- R2 Infrequent Access: **$0.01/GB-month** with $0.01/GB retrieval fee — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- **Egress to internet: $0 (free)** — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Class A operations (writes): $4.50 per million; Class B (reads): $0.36 per million — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Free tier: 10 GB-month storage, 10 million Class B requests, 1 million Class A requests — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- R2 has no India-specific location; nearest hint is "apac" — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- Cloudflare's CDN network has 22+ Indian city PoPs including Mumbai, Delhi, Bangalore, Chennai, Hyderabad — [Cloudflare blog](https://blog.cloudflare.com/cloudflare-launches-in-india-with-data-centers-in-mumbai-chennai-and-new-delhi/)
- Signed URL support: yes, via Cloudflare Workers with signed tokens — [Cloudflare documentation](https://developers.cloudflare.com/r2/)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage (Standard) | 50 GB x $0.015 | $0.75 |
| Egress | 500 GB x $0 | $0.00 |
| Operations (est. 500K reads) | ~$0.18 | $0.18 |
| **Total** | | **~$0.93** |

#### Inferences
- R2 is roughly 50x cheaper than S3 direct egress for this scenario.
- The lack of an India storage region is mitigated by Cloudflare's CDN PoPs caching content at the edge in Indian cities.
- For an offline-first app where users download packs, the origin latency is less critical — downloads happen in the background over Wi-Fi.

---

### Bunny.net Storage

#### Takeaway
Bunny offers the simplest, most affordable all-in-one storage + CDN package with multiple Indian CDN PoPs. Storage is the cheapest at $0.01/GB, though there is no India storage region yet (Singapore is nearest). The $1/month minimum is negligible.

#### Cited Findings
- Standard HDD storage: **$0.01/GB-month** (single region), $0.02/GB for 2 regions, $0.025/GB for 3 regions — [Bunny Storage pricing](https://bunny.net/docs/storage/pricing)
- Edge SSD storage: **$0.02/GB per region** — [Bunny Storage pricing](https://bunny.net/docs/storage/pricing)
- $1/month minimum charge — [Bunny Storage pricing](https://bunny.net/pricing/storage/)
- CDN delivery to India (Asia & Oceania): **$0.03/GB** on Standard tier — [Bunny CDN pricing](https://bunny.net/docs/cdn/pricing.md)
- Traffic from Storage to CDN is free — [Bunny Storage pricing](https://bunny.net/docs/storage/pricing)
- Bunny CDN PoPs in India: Bangalore, Chennai, Kolkata, Mumbai, New Delhi — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- Bunny Storage: no India region yet; Singapore is nearest; Mumbai is "planned" — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- 119+ edge locations across 82 countries — [Bunny.net review](https://www.bitdoze.com/bunny-net-review/)
- Signed URL support: yes, via token authentication with URL signing — [Bunny documentation](https://docs.bunny.net/)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress via CDN)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage (1 region) | 50 GB x $0.01 | $0.50 (min $1) |
| CDN delivery (India) | 500 GB x $0.03 | $15.00 |
| **Total** | | **~$16.00** |

#### Inferences
- Bunny's integrated storage-to-CDN pipeline is the simplest to set up and manage.
- At $16/month total it is far cheaper than AWS direct and slightly more than R2 + Cloudflare CDN free tier.
- The planned Mumbai storage region would eliminate the Singapore latency penalty for origin fetches.

---

### Backblaze B2 + Cloudflare

#### Takeaway
B2 combined with Cloudflare's Bandwidth Alliance provides near-zero egress costs at the lowest storage rate. The downside is no India storage region (US or EU only) and a more complex setup requiring a custom domain on Cloudflare.

#### Cited Findings
- B2 storage: **$0.006/GB-month** ($6/TB) — [Backblaze B2 pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- Egress: free up to 3x average monthly storage; free to Bandwidth Alliance partners (Cloudflare, Fastly, bunny.net, CacheFly, Vultr) — [Backblaze B2 pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- Overage egress (non-partner): $0.01/GB — [Backblaze B2 pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- Class A, B, C API calls: free for pay-as-you-go — [Backblaze B2 pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- Free Cloudflare egress requires proxying through a custom domain on Cloudflare — [Cloudflare partner page](https://www.cloudflare.com/en-ca/partners/technology-partners/backblaze/)
- No India storage region — B2 data centers are in US West (Sacramento), US East, and EU Central — [Backblaze documentation](https://www.backblaze.com/b2/cloud-storage-providers.html)
- Signed URL support: yes, B2 supports authorization tokens for private buckets — [Backblaze documentation](https://www.backblaze.com/b2/cloud-storage-providers.html)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress via Cloudflare)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage | 50 GB x $0.006 | $0.30 |
| Egress (via Cloudflare) | $0 | $0.00 |
| **Total** | | **~$0.30** |

#### Inferences
- The absolute cheapest option, but origin is in the US or EU — first-fetch latency to India is 150-250 ms before CDN caching kicks in.
- Excellent for a budget startup if all content is pre-cached at CDN edges.
- Setup is more involved: custom domain on Cloudflare, CNAME proxying, cache rules.

---

### Google Cloud Storage — Mumbai (asia-south1)

#### Takeaway
GCS in Mumbai is competitive on storage pricing and integrates well with Firebase/GCP services. Egress costs are similar to AWS. Best if the rest of the stack is on GCP/Firebase.

#### Cited Findings
- Standard storage in Mumbai: approximately **$0.023/GB-month** (estimated from US rate of $0.022 and typical Asia markup) — [Google Cloud Storage pricing](https://cloud.google.com/storage/pricing)
- Third-party report: ₹1.75/GB (~$0.021) for Standard in Mumbai — [Cyfuture Cloud comparison](https://cyfuture.cloud/kb/storage/cloud-storage-pricing-in-india-from-top-providers-in-2025) (unverified)
- Nearline: ~$0.010/GB, Coldline: ~$0.004/GB, Archive: ~$0.002/GB (approximate, from third-party sources) — [Cyfuture Cloud comparison](https://cyfuture.cloud/kb/storage/cloud-storage-pricing-in-india-from-top-providers-in-2025)
- Egress: approximately $0.08-0.12/GB for India (similar to AWS; first 1 GB free) — [Cyfuture Cloud comparison](https://cyfuture.cloud/kb/storage/cloud-storage-pricing-in-india-from-top-providers-in-2025)
- Signed URL support: yes, via V4 signing — [Google Cloud documentation](https://cloud.google.com/storage/docs/access-control/signed-urls)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage (Standard) | 50 GB x $0.023 | $1.15 |
| Egress (est. $0.10/GB avg) | 500 GB x $0.10 | $50.00 |
| **Total** | | **~$51.15** |

#### Gaps
- Could not confirm exact Mumbai-region per-GB rates from Google's official pricing page in this research. The $0.023 figure is an estimate based on US pricing plus typical regional markup.

---

### Supabase Storage

#### Takeaway
Supabase Storage is best for small-scale use (user avatars, progress photos) integrated with a Supabase backend. It is not cost-effective for video storage and delivery at scale due to limited free-tier storage (1 GB) and expensive overage ($0.021/GB storage, $0.09/GB egress).

#### Cited Findings
- Free tier: 1 GB file storage, 5 GB bandwidth/month, 2 active projects — [JetAdmin Supabase pricing guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- Pro plan: $25/month base, includes 100 GB file storage and 250 GB egress — [MakerKit Supabase pricing](https://makerkit.dev/blog/saas/supabase-pricing)
- Overage: storage at $0.021/GB-month, egress at $0.09/GB — [Activepieces Supabase pricing](https://www.activepieces.com/blog/supabase-pricing-free-tier-limits-pro-costs-egress.md)
- Projects on free tier pause after 1 week of inactivity — [Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- Supabase uses S3-compatible storage under the hood — [Supabase documentation](https://supabase.com/docs/guides/storage)
- Signed URL support: yes, via `createSignedUrl()` API — [Supabase documentation](https://supabase.com/docs/guides/storage)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress)
| Item | Calculation | Cost |
|------|-------------|------|
| Pro plan base | | $25.00 |
| Extra storage (50 - 100 included = 0) | Included in Pro | $0.00 |
| Extra egress (500 - 250 = 250 GB) | 250 GB x $0.09 | $22.50 |
| **Total** | | **~$47.50** |

#### Inferences
- Supabase Storage is practical for user-generated content (progress photos, avatars) where volumes are small.
- For video content at the CasaFit scale, a dedicated object storage + CDN is more cost-effective.
- If using Supabase as the primary backend, use Supabase Storage for user content and a separate provider (R2, Bunny, S3) for video assets.

---

### Azure Blob Storage — Central India

#### Takeaway
Azure Blob in the Central India region is competitive, but pricing details for Mumbai are harder to pin down from public sources. Best if the rest of the stack is Azure-based.

#### Cited Findings
- Hot tier (Central India): approximately ₹1.60/GB (~$0.019/GB) — [Cyfuture Cloud comparison](https://cyfuture.cloud/kb/storage/cloud-storage-pricing-in-india-from-top-providers-in-2025) (unverified, third-party)
- Cool tier (Central India): approximately ₹0.95/GB (~$0.011/GB) — [Cyfuture Cloud comparison](https://cyfuture.cloud/kb/storage/cloud-storage-pricing-in-india-from-top-providers-in-2025) (unverified)
- US reference: Hot at $0.018-$0.023/GB, Cool at ~$0.010/GB — [Ecorpit cloud storage comparison](https://ecorpit.com/cloud-storage-pricing-aws-s3-azure-gcp-cut-bill-2026/)
- Egress: $0.087-$0.12/GB after first 100 GB free (US rates; India may differ) — [Ecorpit comparison](https://ecorpit.com/cloud-storage-pricing-aws-s3-azure-gcp-cut-bill-2026/)
- Cool tier minimum 30-day billing; 128 KiB minimum object size starting July 2026 — [Synextra Azure guide](https://www.synextra.co.uk/?p=50010)
- Signed URL support: yes, via Shared Access Signatures (SAS tokens) — [Azure documentation](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-user-delegation-sas-create)

#### Monthly Cost Estimate (50 GB storage + 500 GB egress)
| Item | Calculation | Cost |
|------|-------------|------|
| Storage (Hot) | 50 GB x $0.019 | $0.95 |
| Egress (est. $0.10/GB avg) | 400 GB x $0.10 (100 GB free) | $40.00 |
| **Total** | | **~$40.95** |

#### Gaps
- Could not confirm exact Central India (Mumbai) pricing from Microsoft's official pricing page. The figures above are from a third-party source.

---

## Part 2: CDN Options

### AWS CloudFront

#### Takeaway
CloudFront has the most Indian PoPs (7 cities + 46 embedded locations) but is one of the most expensive CDNs for India delivery. The new flat-rate plans (starting at $0/month) may reduce costs for predictable workloads.

#### Cited Findings
- India per-GB rate: **$0.109/GB** for the first 10 TB/month — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- $0.085/GB for 10-50 TB/month — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- India PoP cities: Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai, New Delhi, Pune + 46 embedded PoP locations — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- HTTPS request charges for India: $0.012 per 10,000 requests — [PerfSys CloudFront pricing guide](https://perfsys.com/blog/cloudfront-pricing-guide/)
- Flat-rate plans introduced November 2025: tiers at $0, $15, $200, $1,000/month — [PerfSys CloudFront pricing guide](https://perfsys.com/blog/cloudfront-pricing-guide/)
- Origin Shield for additional caching layer to reduce origin fetches — [AWS documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html)
- Free tier: 1 TB transfer out, 10M HTTPS requests/month (always free) — [AWS CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)

#### Monthly Cost Estimate (500 GB India transfer)
| Item | Calculation | Cost |
|------|-------------|------|
| Data transfer (India) | 500 GB x $0.109 | $54.50 |
| HTTPS requests (est. 2M) | 200 x $0.012 | $2.40 |
| **Total** | | **~$56.90** |

Note: With the 1 TB/month free tier, actual cost would be $0 for the first 500 GB, making this effectively **free** at the CasaFit starting scale.

#### Inferences
- The always-free 1 TB/month makes CloudFront extremely attractive at CasaFit's initial scale of 500 GB.
- Beyond 1 TB, India pricing is among the highest in the CDN market.
- Best paired with S3 as origin for seamless integration.

---

### Cloudflare CDN

#### Takeaway
Cloudflare's free plan with R2 provides the best cost-to-performance ratio for India delivery. The 22+ Indian PoPs provide excellent coverage, and the zero-egress R2 integration means the only cost is storage.

#### Cited Findings
- Free plan: unlimited bandwidth, DDoS protection, SSL — [Cloudflare pricing](https://www.cloudflare.com/plans/)
- Pro plan: $20/month adds image optimization, WAF rules — [Cloudflare pricing](https://www.cloudflare.com/plans/)
- India PoPs: 22+ cities including Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india); [Cloudflare blog](https://blog.cloudflare.com/cloudflare-launches-in-india-with-data-centers-in-mumbai-chennai-and-new-delhi/)
- R2 + Cloudflare CDN: R2 egress through Cloudflare's network is free — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Cloudflare Workers for signed URLs, transformations, routing — [Cloudflare documentation](https://developers.cloudflare.com/workers/)
- Video streaming: Cloudflare Stream is a separate paid product ($5/month + $1/1000 min stored + $1/1000 min delivered) — [Cloudflare Stream pricing](https://www.cloudflare.com/products/cloudflare-stream/)

#### Monthly Cost Estimate (500 GB transfer)
| Item | Calculation | Cost |
|------|-------------|------|
| CDN (free plan) | Unlimited | $0.00 |
| R2 storage (50 GB) | 50 x $0.015 | $0.75 |
| R2 operations | ~$0.18 | $0.18 |
| **Total (R2 + CDN)** | | **~$0.93** |

#### Inferences
- By far the cheapest option at any scale.
- The free plan's Terms of Service technically limit serving disproportionate amounts of non-HTML content (video). Enterprise or the paid Stream product is the official answer for large-scale video delivery. At CasaFit's modest initial scale this is unlikely to be an issue, but monitor usage.
- Workers-based signed URLs provide premium content gating.

---

### Bunny CDN

#### Takeaway
Bunny CDN is purpose-built for content delivery with transparent per-GB pricing and strong India coverage. Its Asia rate of $0.03/GB makes it the most affordable paid CDN for India delivery, with 5 Indian PoP cities.

#### Cited Findings
- Asia & Oceania rate: **$0.03/GB** on Standard tier (119 PoPs) — [Bunny CDN pricing](https://bunny.net/docs/cdn/pricing.md)
- Volume tier: lower cost but only 10 strategic PoPs — [Bunny CDN pricing](https://bunny.net/docs/cdn/pricing.md)
- India CDN PoPs: Bangalore, Chennai, Kolkata, Mumbai, New Delhi — [TechPlained India comparison](https://www.techplained.com/r2-vs-s3-vs-bunny-india)
- Bunny Stream: video hosting with adaptive streaming, $5/month + $0.01/GB delivered — [Bunny.net](https://bunny.net/stream/)
- Token authentication for signed URLs — [Bunny documentation](https://docs.bunny.net/)
- No minimum commitment, pay-as-you-go — [Bunny CDN pricing](https://bunny.net/pricing/)

#### Monthly Cost Estimate (500 GB India transfer)
| Item | Calculation | Cost |
|------|-------------|------|
| CDN delivery (India) | 500 GB x $0.03 | $15.00 |
| **Total** | | **~$15.00** |

#### Inferences
- Simple, transparent pricing with no surprises.
- 5 Indian PoPs provide good major-city coverage but may have higher latency in tier-2/3 cities compared to CloudFront's 46 embedded locations.
- Bunny Stream adds HLS adaptive streaming automatically from uploaded MP4s — ideal for workout demo videos.

---

### Azure CDN

#### Takeaway
Azure CDN offers multiple provider options (Microsoft, Akamai, Verizon) but pricing for India is not significantly different from CloudFront. Best if the backend is on Azure.

#### Cited Findings
- Microsoft CDN Standard: approximately $0.081/GB for Asia Pacific (first 10 TB) — [Azure CDN pricing](https://azure.microsoft.com/en-us/pricing/details/cdn/) (estimated from third-party sources)
- India PoPs vary by provider tier: Microsoft tier has fewer PoPs than Akamai or Verizon tiers — general industry knowledge
- Signed URL support: via token authentication — [Azure documentation](https://learn.microsoft.com/en-us/azure/cdn/cdn-token-auth)

#### Monthly Cost Estimate (500 GB India transfer)
| Item | Calculation | Cost |
|------|-------------|------|
| CDN delivery (est.) | 500 GB x $0.081 | $40.50 |
| **Total** | | **~$40.50** |

#### Gaps
- Could not confirm exact India-region per-GB CDN pricing from official Azure pricing page.
- India PoP count varies by CDN tier and was not confirmed from primary sources.

---

### Google Cloud CDN

#### Takeaway
Google Cloud CDN has limited India PoPs compared to CloudFront. Pricing is competitive but not cheaper than Bunny or Cloudflare. Best if using GCP/Firebase backend.

#### Cited Findings
- Asia Pacific per-GB rate: approximately $0.08-0.11/GB — [Google Cloud CDN pricing](https://cloud.google.com/cdn/pricing) (estimated)
- India PoPs: Mumbai, Delhi (fewer dedicated PoPs than CloudFront) — general industry knowledge
- Premium Tier vs Standard Tier networking affects routing quality — [Google Cloud documentation](https://cloud.google.com/network-tiers)

#### Monthly Cost Estimate (500 GB India transfer)
| Item | Calculation | Cost |
|------|-------------|------|
| CDN delivery (est.) | 500 GB x $0.095 | $47.50 |
| **Total** | | **~$47.50** |

#### Gaps
- Exact India-specific pricing and PoP count not confirmed from primary sources.

---

## Part 3: Video Delivery Architecture

### HLS vs MP4 Progressive Download

#### Takeaway
For CasaFit's offline-first model with short 10-30 second exercise demos, **MP4 progressive download is the recommended primary format**. HLS is overkill for clips this short and adds complexity. Use MP4 for downloaded session packs and reserve HLS only if adding a streaming preview feature later.

#### Cited Findings
- MP4 is "a better format for offline use cases because it's a self-contained, single-quality version of the video" — [Mux blog](https://www.mux.com/blog/mp4-support-added-unleash-offline-viewing)
- HLS creates multiple versions at different bitrates; the player downloads small segments for adaptive quality — [Fast.io HLS guide](https://fast.io/resources/hls-streaming/)
- HLS offline download is possible but requires retrieving individual segments and reassembling — [Huawei Cloud FAQ](https://support.huaweicloud.com/intl/en-us/vod_faq/vod080002.html)
- For premium content protection, HLS supports DRM (FairPlay on iOS, Widevine on Android) — general industry knowledge
- Open-source iOS app team moved from MP4 to HLS downloads for subtitle support but noted "we can no longer gate downloads on the backend" — [GitHub PR discussion](https://github.com/razeware/emitron-iOS/pull/554)

#### Inferences
- **For CasaFit specifically:** 10-30 second exercise demos do not benefit from adaptive bitrate streaming. A single well-encoded MP4 at 2-3 quality levels (high/medium/low) is simpler and more reliable.
- Session packs (warm-up + exercises + cool-down) can be bundled as a zip of MP4s or downloaded individually.
- If premium content gating is needed, signed URLs with short expiry on the download endpoint are simpler than DRM for an MVP.

### Video Compression & Format Recommendations for Indian Mobile

#### Takeaway
Use H.264/AVC as the primary codec for maximum device compatibility across India's diverse Android landscape. Encode at multiple quality levels to serve 2G through 4G connections. Consider AV1 as a future optimization for newer devices.

#### Cited Findings
- H.264/AVC is "the best-suited encoder for mobile" with "strong quality at a given bitrate" and "most widely supported by the mobiles in the market" — [CIS India mobile TV FAQ](https://cis-india.org/telecom/resources/mobile-tv-faq)
- Academic research confirms H.264/AVC as the preferred codec for mobile operators — [Academic paper on mobile video codecs](https://www.bib.irb.hr/359559)
- Indian OTT providers have achieved SD video at sub-128kbps for 2G networks using specialized codecs — [DigitalTV Europe on FastFilmz](https://digitaltveurope.com/2016/04/07/indias-fastfilmz-taps-v-nova-to-deliver-ott-to-2g-phones)
- "Downscaling to 1080p or even 720p can drastically reduce the amount of data required" — [IoRiver optimization guide](https://ioriver-proxy.ioriver.io/questions/how-to-optimize-a-video-for-low-bandwidth)

#### Recommended Encoding Ladder for CasaFit Exercise Demos

| Quality | Resolution | Bitrate | Target | File Size (30s) |
|---------|-----------|---------|--------|-----------------|
| Low | 360p | 300-500 kbps | 2G/slow 3G | ~1-2 MB |
| Medium | 480p | 800-1200 kbps | 3G/4G | ~3-4.5 MB |
| High | 720p | 1500-2500 kbps | 4G/Wi-Fi | ~5.5-9.5 MB |

- **Codec:** H.264 High Profile, Level 3.1 (720p) / Level 3.0 (480p and below)
- **Container:** MP4 with moov atom at front (for progressive download)
- **Audio:** AAC-LC, 64-96 kbps mono (exercise demos need minimal audio)
- **Frame rate:** 30 fps (sufficient for exercise demonstrations)

#### Inferences
- At 720p/2500kbps, a 30-second demo is ~9.5 MB. A full session pack of 10-15 exercises would be ~100-150 MB at high quality or ~15-30 MB at low quality.
- The app should auto-select quality based on available storage and network: download high on Wi-Fi, stream low on cellular.
- AV1 offers ~30% better compression than H.264 but requires Android 10+ hardware decode. Consider adding AV1 variants as India's device fleet modernizes.

### Offline-First Download Strategy

#### Architecture
1. **Session Pack Manifest:** API returns a JSON manifest listing all clips in a workout session with URLs for each quality level.
2. **Background Download:** App downloads clips in the background when on Wi-Fi using platform download managers (WorkManager on Android, BGTaskScheduler on iOS).
3. **Quality Selection:** User preference or auto-detect: "Download Quality" setting (Low/Medium/High) in app settings. Default to Medium.
4. **Storage Management:** Track downloaded packs, auto-delete oldest completed sessions when device storage is low. Show storage usage in settings.
5. **Signed URLs:** For Pro content, generate short-lived signed URLs (1-4 hours) at download initiation time. The downloaded file persists locally — the URL only needs to be valid during the download.
6. **Delta Updates:** When exercise library updates, only download new/changed clips, not the entire pack.

### Thumbnail Generation & Caching

#### Strategy
- Generate thumbnails at upload time (not on-the-fly) at 3 sizes: 150x150 (list), 400x300 (card), 800x600 (detail).
- Store thumbnails alongside videos in the same storage bucket.
- Use aggressive CDN cache headers: `Cache-Control: public, max-age=31536000, immutable` (thumbnails are versioned by filename hash).
- Use WebP format for thumbnails (30% smaller than JPEG, supported on all modern Android/iOS).

### Cost Optimization Strategies

1. **Aggressive CDN caching:** Set long TTLs (1 year) for video and image assets with cache-busting via content-hash filenames. Exercise videos rarely change.
2. **Compression at source:** Proper encoding saves more bandwidth than any CDN optimization. Use the encoding ladder above.
3. **Regional storage replication:** Only replicate to regions with significant user bases. Start with a single Asia region (Singapore or Mumbai).
4. **Lazy loading:** Don't preload all exercise thumbnails — load them as the user scrolls through the exercise library.
5. **Download scheduling:** Encourage Wi-Fi downloads by showing "Download on Wi-Fi" prompts. This reduces cellular CDN costs.
6. **Storage tiering:** Move rarely-accessed content (old seasonal workouts) to IA/Cool tiers after 90 days.
7. **Deduplication:** Many exercises appear in multiple sessions — store each clip once and reference by ID, not by session.

---

## Part 4: Complete Storage + CDN Bundles

### Option A: AWS S3 + CloudFront (AWS Native)

| Component | Monthly Cost |
|-----------|-------------|
| S3 Standard (50 GB) | $1.25 |
| CloudFront (500 GB, India) | **$0** (within 1 TB free tier) |
| CloudFront HTTPS requests | **$0** (within 10M free tier) |
| **Total at 500 GB** | **~$1.25** |
| **Total at 2 TB (scaled)** | ~$1.25 + (1000 GB x $0.109) = **~$110.25** |

**Pros:** Free tier covers CasaFit's initial scale entirely. Deepest India PoP coverage (7 cities + 46 embedded). Native integration, signed URLs, Origin Shield. Mature ecosystem.
**Cons:** Most expensive once past the free tier. Vendor lock-in.
**Best for:** Launch phase (free) and teams already on AWS.

---

### Option B: Cloudflare R2 + Cloudflare CDN (Zero Egress)

| Component | Monthly Cost |
|-----------|-------------|
| R2 Storage (50 GB) | $0.75 |
| R2 Operations | ~$0.18 |
| Cloudflare CDN | $0 (free plan) |
| Workers (signed URLs) | $0 (free tier: 100K requests/day) |
| **Total at 500 GB** | **~$0.93** |
| **Total at 5 TB (scaled)** | **~$0.93** (egress stays free) |

**Pros:** Cheapest at every scale. Cost doesn't grow with bandwidth. 22+ Indian CDN PoPs. Workers for programmable edge logic.
**Cons:** No India R2 storage region (origin in APAC/Singapore). Cloudflare ToS technically limits non-HTML content on free plan (enforcement risk at scale). More complex signed-URL setup via Workers.
**Best for:** Budget-conscious startups. Best long-term cost structure.

---

### Option C: Bunny Storage + Bunny CDN (Simple, India-Focused)

| Component | Monthly Cost |
|-----------|-------------|
| Bunny Storage (50 GB, 1 region) | $1.00 (minimum) |
| Bunny CDN (500 GB, Asia) | $15.00 |
| **Total at 500 GB** | **~$16.00** |
| **Total at 2 TB (scaled)** | $1.00 + (2000 x $0.03) = **~$61.00** |

**Pros:** Simplest setup — one vendor, one dashboard. 5 Indian CDN PoP cities. Bunny Stream adds HLS transcoding for $5/month. Transparent pricing. Excellent documentation.
**Cons:** No India storage region yet (Singapore nearest). More expensive than R2 at scale.
**Best for:** Teams wanting simplicity and willing to pay a moderate premium. Excellent middle ground.

---

### Option D: Backblaze B2 + Cloudflare CDN (Ultra Budget)

| Component | Monthly Cost |
|-----------|-------------|
| B2 Storage (50 GB) | $0.30 |
| Cloudflare CDN | $0 (free plan) |
| **Total at 500 GB** | **~$0.30** |
| **Total at 5 TB (scaled)** | **~$0.30** |

**Pros:** Absolute cheapest storage + delivery combination possible. Cloudflare Bandwidth Alliance gives free egress.
**Cons:** B2 has no Asia storage region — origin fetches cross the Pacific (150-250 ms). Most complex setup (custom domain, CNAME proxy, Cloudflare cache rules). Same Cloudflare ToS concerns as Option B.
**Best for:** Absolute budget minimum. Acceptable if all content is CDN-cached and origin latency is hidden from users.

---

### Option E (Hybrid — Recommended for CasaFit): S3 + CloudFront (launch) → R2 + Cloudflare (scale)

| Phase | Setup | Monthly Cost |
|-------|-------|-------------|
| **Launch (0-1 TB)** | S3 Mumbai + CloudFront free tier | ~$1.25 |
| **Growth (1-5 TB)** | Migrate to R2 + Cloudflare CDN | ~$1-2 |
| **Scale (5+ TB)** | R2 + Cloudflare Pro ($20/mo) | ~$22 |

**Rationale:**
1. Start with S3 + CloudFront: the 1 TB/month free CloudFront tier covers the initial 500 GB target. S3 Mumbai provides the lowest origin latency in India. Setup is straightforward with AWS SDK.
2. When bandwidth exceeds 1 TB/month, migrate videos to R2 for zero egress. Cloudflare's 22+ Indian PoPs provide excellent coverage. The migration is a one-time bulk copy.
3. At scale, the Cloudflare Pro plan ($20/month) adds image optimization and better analytics while keeping egress at $0.

**User-generated content (progress photos):** Keep in Supabase Storage if using Supabase as the backend. Small volume, integrated auth, simple API.

---

## Summary Comparison Table

| Bundle | Storage/mo | CDN/mo | Total (500 GB) | Total (2 TB) | India PoPs | Complexity |
|--------|-----------|--------|----------------|--------------|------------|------------|
| S3 + CloudFront | $1.25 | $0* | **$1.25** | $110.25 | 7+ cities | Low |
| R2 + Cloudflare | $0.75 | $0 | **$0.93** | $0.93 | 22+ cities | Medium |
| Bunny Storage + CDN | $1.00 | $15.00 | **$16.00** | $61.00 | 5 cities | Low |
| B2 + Cloudflare | $0.30 | $0 | **$0.30** | $0.30 | 22+ cities | High |
| Azure Blob + CDN | $0.95 | $40.50 | **$41.45** | ~$122 | Varies | Medium |

\* CloudFront free tier covers first 1 TB/month

---

## Gaps & Notes

- **AWS S3 Mumbai exact pricing:** The $0.025/GB figure comes from a reputable third-party comparison, not from AWS's own pricing page (which did not render regional rates during this research). Verify at [aws.amazon.com/s3/pricing](https://aws.amazon.com/s3/pricing/).
- **Google Cloud Storage Mumbai pricing:** Not confirmed from primary source. Use the GCP pricing calculator for exact figures.
- **Azure Blob Central India pricing:** Not confirmed from primary source. Check [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/).
- **Cloudflare free-plan video ToS enforcement:** Cloudflare's free plan ToS limits disproportionate non-HTML content. In practice, enforcement against small-scale users is rare, but this is a risk to monitor.
- **Bunny Mumbai storage region timeline:** TechPlained lists it as "planned" but no official timeline was found.
- **AV1 codec support on Indian Android devices:** No data found on what percentage of Indian smartphones support AV1 hardware decode. This would be valuable for deciding when to add AV1 encoding variants.
- **KeyCDN:** Was listed in the research brief but deprioritized in favor of more commonly used alternatives. KeyCDN charges approximately $0.04/GB for Asia with PoPs in Mumbai and Singapore.
