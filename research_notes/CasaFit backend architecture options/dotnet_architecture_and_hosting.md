# ASP.NET Core Architecture Mapping and Hosting for CasaFit

## Part 1: How Each NestJS Module Maps to ASP.NET Core

### Takeaway
NestJS and ASP.NET Core share remarkably similar patterns: decorator-based routing, constructor-injected services, and middleware pipelines. The main structural difference is that NestJS groups code into `@Module()` classes, whereas ASP.NET Core uses `IServiceCollection` extension methods (or feature folders/class libraries) for the same purpose.

### Cited Findings
- NestJS's decorator-based routing and DI closely resemble the .NET Controller API approach; NestJS is more comparable to .NET Controller APIs than plain Express.js — [TypeScript is Like C#](https://typescript-is-like-csharp.chrlschn.dev/pages/intermediate/nest-vs-controller-api)
- In ASP.NET Core, services are registered at startup in `Program.cs`, with three lifetimes: Singleton, Scoped, and Transient — [Leapcell Blog](https://leapcell.io/blog/empowering-backend-development-with-ioc-containers-in-nestjs-and-asp-net-core)
- A NestJS controller receiving a service through constructor injection has a near-identical ASP.NET Core counterpart using `[ApiController]` and `[HttpGet]` attributes — [TypeScript is Like C#](https://typescript-is-like-csharp.chrlschn.dev/pages/intermediate/nest-vs-controller-api)
- A third-party NuGet package (ModularNet.Core) offers NestJS-style modules for ASP.NET Core with self-contained, reusable modules, but this is not built into the framework — [NuGet](https://www.nuget.org/packages/modularnet.core)

### Module-by-Module Mapping

| NestJS Module | ASP.NET Core Equivalent |
|---|---|
| **Auth** (OTP + JWT) | `AuthController` + `AuthService`; use ASP.NET Core's built-in JWT Bearer authentication middleware (`AddAuthentication().AddJwtBearer()`), or ASP.NET Identity for full user management. OTP logic stays in a custom service. |
| **Accounts** (profile, plan metadata) | `AccountsController` + `AccountsService`; standard CRUD controller with EF Core or Dapper for data access. |
| **Entitlements** (lifetime free-check, Pro via RevenueCat) | `EntitlementsController` + `EntitlementsService`; RevenueCat webhook handling in a dedicated controller. |
| **Content** (signed URLs for videos/food packs) | `ContentController` + `ContentService`; generate signed URLs using AWS SDK for .NET or Azure Blob Storage SDK. |
| **Analytics** (PostHog passthrough) | `AnalyticsController` + `AnalyticsService`; simple HTTP proxy using `HttpClient` / `IHttpClientFactory`. |
| **Admin** | `AdminController` + role-based authorization via `[Authorize(Roles = "Admin")]`. |
| **NestJS Module decorator** | No direct equivalent. Use C# class library projects per domain area, or extension methods like `services.AddAuthModule()` on `IServiceCollection` in `Program.cs`. |
| **NestJS Guards** | ASP.NET Core Authorization Policies and `IAuthorizationHandler`. |
| **NestJS Interceptors** | ASP.NET Core Action Filters or Middleware. |
| **NestJS Pipes (class-validator)** | FluentValidation or DataAnnotations (see Validation section below). |
| **NestJS Exception Filters** | ASP.NET Core Exception Handling Middleware or `IExceptionHandler` (.NET 8+). |

### Project Structure (Recommended)

```
CasaFit.Api/
  Controllers/
    AuthController.cs
    AccountsController.cs
    EntitlementsController.cs
    ContentController.cs
    AnalyticsController.cs
    AdminController.cs
  Program.cs
CasaFit.Application/          (business logic / services)
  Auth/AuthService.cs
  Accounts/AccountsService.cs
  Entitlements/EntitlementsService.cs
  Content/ContentService.cs
  Analytics/AnalyticsService.cs
CasaFit.Domain/               (entities, interfaces)
CasaFit.Infrastructure/       (EF Core DbContext, Redis, external APIs)
CasaFit.Shared/               (DTOs, constants)
```

This "Clean Architecture" layout is the most common .NET pattern for medium-sized APIs. Each project is a class library referenced by the API project.

### Inferences
- The NestJS-to-ASP.NET migration is structurally straightforward because both frameworks use the same patterns (controllers, services, DI, middleware).
- The lack of a built-in module system in .NET means you rely on convention (folder structure, class libraries, extension methods) rather than framework-enforced boundaries.
- ASP.NET Core's built-in DI container is sufficient for this app's complexity; third-party containers like Autofac are unnecessary.

### Gaps
- No benchmarks comparing NestJS vs ASP.NET Core API throughput for a comparable workload.

---

## ORM: Entity Framework Core vs Dapper vs Others

### Takeaway
For CasaFit, Entity Framework Core is the pragmatic default: it provides migrations, change tracking, and LINQ, which accelerate development. Dapper is better suited for read-heavy hot paths where raw SQL performance matters. A hybrid approach (EF Core for writes, Dapper for complex reads) is common.

### Cited Findings
- A 2026 benchmark on PostgreSQL with .NET 10 found Dapper reduces managed allocations and often improves mean latency, with the largest advantage for join-intensive queries — [7universum.com](https://7universum.com/en/tech/archive/item/23040)
- EF Core provides change tracking, migrations, and LINQ support; Dapper has no built-in change tracking — [Devart Blog](https://www.devart.com/blog/dapper-vs-entity-framework-core.html)
- EF Core suits applications where rapid development and abstraction matter more than raw performance; Dapper suits high-performance microservices and read-heavy applications — [DEV Community](https://dev.to/dev_saeid_ghaderi/dapper-vs-ef-core-performance-showdown-in-2025-4j32)
- Dapper executes raw SQL directly and maps results to .NET objects — [ntechdevelopers](https://ntechdevelopers.readthedocs.io/en/latest/08_dar/differences/differences_efcore_vs_dapper.html)

### Comparison to Prisma 5

| Feature | Prisma 5 (current) | EF Core 8/9 | Dapper |
|---|---|---|---|
| Migrations | Prisma Migrate | EF Migrations (code-first) | Manual (FluentMigrator or DbUp) |
| Schema-first | Yes (.prisma file) | Code-first or DB-first | N/A |
| Query builder | Prisma Client (generated) | LINQ to Entities | Raw SQL |
| Change tracking | No | Yes | No |
| Performance | Good | Good (overhead on complex queries) | Best (thin mapper) |
| PostgreSQL support | Excellent | Excellent (Npgsql provider) | Excellent |

### Inferences
- EF Core is the closest equivalent to Prisma's developer experience (code-first, migrations, typed queries).
- For CasaFit's scale (early-stage, ~1000s of users), EF Core's overhead is negligible, and the productivity gains outweigh the performance gap.
- The Npgsql provider for EF Core supports PostgreSQL 16 fully, including JSON columns, full-text search, and array types.

### Gaps
- No head-to-head Prisma vs EF Core benchmark was found.

---

## Auth: ASP.NET Identity vs Custom JWT

### Takeaway
For CasaFit's OTP + JWT flow, a custom JWT implementation using ASP.NET Core's built-in `AddAuthentication().AddJwtBearer()` is simpler and more appropriate than ASP.NET Identity, which is designed for username/password flows with cookie-based sessions.

### Cited Findings
- ASP.NET Core provides built-in JWT Bearer authentication middleware that validates tokens on every request — based on Microsoft documentation (no single URL from search results)
- ASP.NET Identity provides a full user management system with password hashing, 2FA, account lockout, and claims management — based on Microsoft documentation

### Inferences
- ASP.NET Identity adds unnecessary complexity for an OTP-only auth flow. It assumes password-based authentication at its core.
- The recommended approach: use `AddJwtBearer()` for token validation, write a custom `AuthService` for OTP generation/verification and JWT token issuance, and store refresh tokens in PostgreSQL or Redis.
- This mirrors the current NestJS implementation where JWT is handled with `@nestjs/jwt` and `passport-jwt`.

### Gaps
- No direct comparison of ASP.NET Identity vs custom JWT for OTP-first mobile apps was found in search results.

---

## Validation: FluentValidation vs DataAnnotations

### Takeaway
FluentValidation is the better fit for CasaFit, mirroring the expressiveness of NestJS's class-validator with dedicated validator classes that support complex rules, async checks, and clean unit testing.

### Cited Findings
- DataAnnotations are built into .NET and integrate directly with ASP.NET model binding; they suit basic formats and ranges — [Luis Llamas](https://www.luisllamas.es/en/aspnet-core-model-validation-data-annotations-fluentvalidation/)
- FluentValidation moves validation out of model attributes into dedicated validator classes, supporting conditional logic, async database checks, dependency injection, and easier unit testing — [Hashnode](https://hashnode.com/n/net)
- The legacy FluentValidation.AspNetCore auto-validation package is deprecated and removed in v12; the recommended approach is to inject `IValidator<T>` or use an endpoint filter — [CodeWithMukesh](https://codewithmukesh.com/blog/fluentvalidation-in-aspnet-core/)
- .NET 10+ introduces built-in validation via `AddValidation()` with source-generated 400 responses (unconfirmed against Microsoft docs) — [startdebugging.net](https://startdebugging.net/ja/2026/06/minimal-api-validation-vs-fluentvalidation-in-aspnetcore-11/)

### Mapping from class-validator

| class-validator (NestJS) | FluentValidation (.NET) |
|---|---|
| `@IsNotEmpty()` | `RuleFor(x => x.Name).NotEmpty()` |
| `@IsEmail()` | `RuleFor(x => x.Email).EmailAddress()` |
| `@MinLength(3)` | `RuleFor(x => x.Name).MinimumLength(3)` |
| `@IsEnum(MyEnum)` | `RuleFor(x => x.Type).IsInEnum()` |
| `@ValidateNested()` | `RuleFor(x => x.Address).SetValidator(new AddressValidator())` |

### Inferences
- FluentValidation is the closest equivalent to class-validator's dedicated DTO validation approach.
- For a new project on .NET 9+, you could start with DataAnnotations for simple DTOs and add FluentValidation only where complex rules are needed.

### Gaps
- No information found on whether .NET 10's built-in validation is production-ready or widely adopted.

---

## API Documentation: Swashbuckle/NSwag for OpenAPI

### Takeaway
ASP.NET Core has first-class OpenAPI support. Starting in .NET 9, Microsoft ships `Microsoft.AspNetCore.OpenApi` as a built-in package, replacing the need for third-party Swashbuckle or NSwag in many cases.

### Cited Findings
- Swashbuckle.AspNetCore has been the de facto standard for OpenAPI generation in ASP.NET Core for years (common knowledge; no single search result).
- NSwag can both generate OpenAPI specs from controllers and generate C# / TypeScript clients from specs.
- Starting with .NET 9, Microsoft includes built-in OpenAPI document generation via `Microsoft.AspNetCore.OpenApi`, with Swagger UI available as an optional add-on.

### Inferences
- For CasaFit, `Microsoft.AspNetCore.OpenApi` (built-in) + Scalar or Swagger UI for the interactive docs page is the simplest setup.
- This is a direct replacement for NestJS's `@nestjs/swagger` module.

### Gaps
- No detailed comparison of the three options' feature sets was found in search results.

---

## Queue/Background Jobs: Hangfire vs Quartz.NET

### Takeaway
Hangfire is the better equivalent to BullMQ for CasaFit. It provides fire-and-forget and delayed jobs with a monitoring dashboard, persistent storage in Redis or PostgreSQL, and simpler setup than Quartz.NET.

### Cited Findings
- Hangfire is arguably the most widely adopted library for background job processing in .NET; its job state can live in SQL Server, Redis, or PostgreSQL, and it ships a monitoring dashboard — [BoldSign Blog](https://boldsign.com/blogs/aspnet-core-background-jobs-hosted-services-hangfire-quartz/)
- Quartz.NET is a port of the Java Quartz scheduler; its strength is cron expressions, calendars, misfire policies, and clustering — [WireFuture](https://wirefuture.com/post/background-jobs-in-net-hangfire-vs-quartz-vs-worker-services)
- Rule of thumb: if you want to run something later and know it happened, Hangfire; if deciding when is the hard part, Quartz.NET — [C# Corner](https://www.c-sharpcorner.com/article/background-jobs-in-asp-net-co-hangfire-vs-quartz-net-vs-hosted-services/)
- Most ASP.NET Core apps start with BackgroundService and graduate to Hangfire when they need durability — [Code-Maze](https://code-maze.com/?p=101079)

### Mapping from BullMQ

| BullMQ (NestJS) | Hangfire (.NET) |
|---|---|
| `queue.add('job', data)` | `BackgroundJob.Enqueue(() => service.DoWork(data))` |
| `queue.add('job', data, { delay: 5000 })` | `BackgroundJob.Schedule(() => service.DoWork(data), TimeSpan.FromSeconds(5))` |
| Repeatable jobs | `RecurringJob.AddOrUpdate("id", () => service.DoWork(), Cron.Hourly)` |
| Bull Board (dashboard) | Hangfire Dashboard (built-in at `/hangfire`) |
| Redis-backed | Redis-backed (Hangfire.Pro.Redis) or PostgreSQL-backed (Hangfire.PostgreSql) |

### Inferences
- Hangfire's Redis storage requires the paid Hangfire.Pro license ($500 one-time per developer). The free/open-source tier supports SQL Server and PostgreSQL storage.
- For a startup on a budget, using Hangfire with PostgreSQL storage (free) is the pragmatic choice, keeping Redis for caching only.
- If CasaFit only needs simple delayed tasks (e.g., OTP expiry cleanup), `BackgroundService` (built-in, zero dependencies) may suffice initially.

### Gaps
- Hangfire Pro Redis license pricing may have changed; the $500 figure is from the Hangfire website circa 2024.

---

## Dependency Injection

### Takeaway
ASP.NET Core's built-in DI container is fully sufficient for CasaFit and is the direct equivalent of NestJS's IoC container. No third-party container is needed.

### Cited Findings
- ASP.NET Core provides three main lifetimes: Singleton, Scoped, and Transient — [Leapcell Blog](https://leapcell.io/blog/empowering-backend-development-with-ioc-containers-in-nestjs-and-asp-net-core)
- The built-in container supports constructor injection, interface-based registration, and factory methods.

### Inferences
- NestJS's `@Injectable()` maps to registering a service in `Program.cs` with `builder.Services.AddScoped<IAuthService, AuthService>()`.
- NestJS's module-scoped providers map to ASP.NET's scoped lifetime.

### Gaps
- None.

---

## Pros and Cons of Switching from NestJS to .NET for CasaFit

### Takeaway
Switching to .NET offers better raw performance and stronger typing, but at the cost of a heavier Docker image, a smaller pool of affordable Indian developers familiar with .NET backend work, and the effort of rewriting existing code.

### Pros
- **Performance:** ASP.NET Core consistently outperforms Node.js/NestJS in TechEmpower benchmarks for JSON serialization and database queries.
- **Type safety:** C# provides compile-time type checking that catches errors TypeScript's structural typing misses.
- **Mature ecosystem:** EF Core, Identity, built-in OpenAPI, Hangfire, and the Azure SDK are all production-grade.
- **Single runtime:** No Node.js version management; .NET runtime is self-contained in Docker images.
- **Long-term support:** .NET 8 LTS is supported until November 2026; .NET 10 LTS is expected November 2025.

### Cons
- **Rewrite cost:** All existing NestJS code must be rewritten. There is no automated migration path.
- **Docker image size:** .NET self-contained images are ~80-120 MB vs ~50-70 MB for Node.js Alpine images (can be mitigated with trimming and AOT).
- **Cold start:** .NET JIT compilation causes slower cold starts than Node.js, relevant for serverless/scale-to-zero platforms. (Mitigated by AOT in .NET 8+.)
- **Developer pool in India:** Node.js/TypeScript developers are more abundant and typically less expensive than .NET developers in the Indian market.
- **Learning curve:** If the team is currently Node.js-focused, ramping up on C# and .NET conventions takes time.
- **RevenueCat SDK:** RevenueCat's server-side SDK is available for Node.js but you would need to use their REST API directly from .NET (no official .NET SDK).

### Inferences
- For CasaFit at its current stage (pre-launch, small team), the rewrite cost likely outweighs the performance benefits.
- If the team has .NET experience or plans to hire .NET developers, the switch is viable.
- A pragmatic middle ground: keep NestJS now, and consider .NET only if performance bottlenecks emerge or the team composition changes.

---

# Part 2: Hosting Platforms for .NET with India/Mumbai Region

## Railway (railway.app)

### Takeaway
Railway does not have an India region. It supports .NET via Docker, but the nearest region is Singapore, which adds latency and does not satisfy DPDP Act data residency.

### Cited Findings
- Multiple user feature requests on Railway's feedback board ask for an India region (Mumbai, Bangalore), citing data residency needs; all are marked "Under Review" with no timeline — [Railway Feedback](https://station.railway.com/feedback/request-an-india-region-for-railway-df4af9f2); [Railway Feedback #2](https://station.railway.com/feedback/feature-request-add-an-india-infrastruc-fee82197)
- The closest available region is Southeast Asia (Singapore) — from Railway feedback posts

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Dockerfile or Nixpacks |
| India region | No (Singapore nearest) |
| Pricing | Hobby: $5/month + usage; Pro: $20/month + usage. RAM ~$10/GB/month |
| Free tier | Trial with $5 credit |
| DPDP compliance | Not possible (no India data center) |

### Gaps
- Could not confirm exact current pricing from official source in this search.

---

## Render (render.com)

### Takeaway
Render does not have an India region. It supports .NET via Docker, but Singapore is the nearest region.

### Cited Findings
- Render's official regions are Oregon, Ohio, Virginia, Frankfurt, and Singapore — [Render Docs](https://render.com/docs/regions)
- For languages not natively supported like ASP.NET, Render recommends containerization via Docker — [Render Docker Docs](https://docs.render.com/docker)
- A third-party review estimates 100-150 ms latency from Singapore to Indian users — [ProductGrowth.in](https://productgrowth.in/tools/developer/render/)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Dockerfile |
| India region | No (Singapore nearest) |
| Pricing | Individual: free tier (750 hours/month, spins down after inactivity); Starter: $7/month per service; Standard: $25/month (1 CPU, 2 GB RAM) |
| Free tier | Yes, with spin-down on inactivity |
| DPDP compliance | Not possible (no India data center) |

### Gaps
- Exact Singapore-region pricing premium (if any) not confirmed.

---

## Azure App Service / Azure Container Apps

### Takeaway
Azure has three India regions (Central India/Pune, South India/Chennai, West India/Mumbai) and offers first-class .NET support. It is the strongest option for DPDP Act compliance among the hyperscalers.

### Cited Findings
- Azure has Central India (Pune), South India (Chennai), and West India (Mumbai) regions — [Azure Regions](https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/)
- Azure Container Apps consumption plan includes a monthly free grant of 180,000 vCPU-seconds, 360,000 GiB-seconds, and 2 million requests per subscription — [Azure Pricing](https://azure.microsoft.com/en-gb/pricing/details/container-apps/)
- A third-party estimate puts Container Apps consumption compute at approximately $63.07 per vCPU per month (730 hours) — [Sliplane comparison, 2026]
- Microsoft does not publish retail pricing for Jio India regions via the public API — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2276421/azure-api-doesnt-give-pricing-information-for-jio)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | First-class (App Service has built-in .NET runtime; Container Apps runs any Docker image) |
| India region | Yes: Central India (Pune), South India (Chennai), West India (Mumbai) |
| Pricing (App Service) | Basic B1: ~$13/month (1 core, 1.75 GB); Standard S1: ~$70/month (estimate for India) |
| Pricing (Container Apps) | Consumption: pay-per-use after free grant (~$0.000024/vCPU-sec). Dedicated: from ~$63/vCPU/month |
| Free tier | App Service: F1 free tier (60 min CPU/day, 1 GB RAM, shared). Container Apps: generous free grant |
| DPDP compliance | Yes, data stays in India |

### Inferences
- Azure App Service is the easiest path: deploy a .NET app with `az webapp up` and it runs with zero Docker knowledge.
- Azure Container Apps is better for microservices and scale-to-zero workloads.
- Azure's free tier is genuinely usable for development and low-traffic production.
- Azure for Startups program offers up to $150K in credits for eligible startups.

### Gaps
- Exact INR pricing for App Service and Container Apps in Central India not confirmed from official source; use Azure Pricing Calculator for accurate figures.

---

## AWS (ECS Fargate, App Runner, Elastic Beanstalk)

### Takeaway
AWS has a mature Mumbai region (ap-south-1) with full ECS Fargate and Elastic Beanstalk support. App Runner availability in Mumbai should be verified. AWS is the most flexible option but requires more infrastructure management.

### Cited Findings
- AWS ap-south-1 (Mumbai) is a long-established region with full service availability — [AWS Regions](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/)
- Fargate Linux/x86 pricing in US East: $0.04048/vCPU-hour, $0.004445/GB-hour; Linux/ARM: $0.03238/vCPU-hour, $0.00356/GB-hour — [Vantage](https://www.vantage.sh/blog/fargate-pricing); [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- Billing is per-second with a one-minute minimum — [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- AWS charges 18% GST in India; GST-registered businesses can reclaim it as input credit — [PrecisionTech](https://precisiontech.in/cloud/amazon-aws-cloud/aws-pricing/)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes: Docker on Fargate/ECS; Elastic Beanstalk has .NET platform; App Runner supports Docker |
| India region | Yes: ap-south-1 (Mumbai), ap-south-2 (Hyderabad) |
| Pricing (Fargate, Mumbai est.) | ~$0.04-0.05/vCPU-hour, ~$0.005/GB-hour (Mumbai typically 5-15% above US East) |
| Estimated monthly (1 vCPU, 2 GB) | ~$35-45/month for always-on |
| Free tier | 12-month free tier: Fargate not included; EC2 t2.micro (750 hrs/month); App Runner has limited free tier |
| DPDP compliance | Yes, data stays in India |

### Inferences
- For CasaFit, ECS Fargate is the best AWS option: serverless containers, no EC2 management, auto-scaling.
- ARM (Graviton) instances save ~20% on Fargate and .NET runs well on ARM.
- AWS Activate program offers up to $100K in credits for startups.
- Elastic Beanstalk is simpler but less flexible; App Runner is simplest but may have fewer regions.

### Gaps
- Exact Mumbai Fargate pricing not confirmed from official source (region selector did not load in web fetch).
- App Runner availability in ap-south-1 not confirmed.

---

## Google Cloud Run

### Takeaway
Cloud Run has a Mumbai region (asia-south1) with Tier 1 pricing and a generous free tier. It supports .NET via Docker and is excellent for scale-to-zero workloads.

### Cited Findings
- Cloud Run is available in asia-south1 (Mumbai, India), grouped under Tier 1 pricing — [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- Free tier includes 240,000 vCPU-seconds and a similar memory allowance per month (based on us-central1 rates) — [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- Committed use discounts can lower costs for always-on services — [Cloud Run Pricing](https://cloud.google.com/run/pricing)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Docker container |
| India region | Yes: asia-south1 (Mumbai), asia-south2 (Delhi) |
| Pricing | Pay-per-use: ~$0.00002400/vCPU-sec, ~$0.00000250/GiB-sec (Tier 1, verify for Mumbai) |
| Estimated monthly (1 vCPU, 2 GB, always-on) | ~$50-65/month before free tier |
| Free tier | Yes: 240,000 vCPU-seconds (~67 vCPU-hours), 2M requests/month |
| DPDP compliance | Yes, data stays in India |

### Inferences
- Cloud Run's scale-to-zero model is ideal for a startup with variable traffic: you pay nothing during idle periods.
- Cold start latency (3-5 seconds for .NET JIT) can be mitigated with min-instances=1 or .NET AOT compilation.
- Cloud Run is arguably the simplest serverless container platform to use among the hyperscalers.
- Google Cloud for Startups offers up to $200K in credits over 2 years.

### Gaps
- Exact Mumbai-specific per-second rates not confirmed; Tier 1 pricing likely applies but should be verified in pricing calculator.

---

## DigitalOcean App Platform

### Takeaway
DigitalOcean has a Bangalore region (BLR1) for Droplets, but App Platform's region availability for BLR1 is unconfirmed. It supports .NET via Docker.

### Cited Findings
- DigitalOcean opened Bangalore region (BLR1) in 2016 — [DigitalOcean Blog](https://www.digitalocean.com/company/blog/introducing-our-bangalore-region-blr1/)
- DigitalOcean maintains uniform pricing across all datacenters — [DigitalOcean Blog](https://www.digitalocean.com/company/blog/introducing-our-bangalore-region-blr1/)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Dockerfile on App Platform; or Docker on Droplets |
| India region | Droplets: Yes (BLR1). App Platform: Unconfirmed for BLR1 |
| Pricing (App Platform) | Basic: $5/month (1 container, 512 MB); Professional: from $12/month (1 vCPU, 1 GB) |
| Pricing (Droplet) | Basic: $6/month (1 vCPU, 1 GB); $12/month (1 vCPU, 2 GB) |
| Free tier | App Platform: 3 static sites free; no free compute tier |
| DPDP compliance | Possible if BLR1 is available for chosen product |

### Inferences
- If App Platform does not support BLR1, deploying on a Droplet with Docker Compose (or Coolify) is the fallback.
- DigitalOcean's pricing is competitive and predictable (flat rate, no per-request charges).
- The Hatch program for startups offers up to $10K in credits.

### Gaps
- Could not confirm whether App Platform runs in BLR1 from search results. Check DigitalOcean App Platform docs directly.

---

## Fly.io

### Takeaway
Fly.io previously listed Mumbai (bom) as a region, but the current official regions page (fetched October 2026) does not list it. The nearest confirmed region is Singapore (sin). Availability may depend on plan tier.

### Cited Findings
- The official Fly.io regions page lists 17 regions; Mumbai (bom) is NOT among them. The nearest is Singapore (sin) — [Fly.io Regions Docs](https://docs.fly.io/reference/regions)
- Earlier search results and third-party pages reference Mumbai (bom) as available on the Launch plan or higher, but this conflicts with the official page — [Fly.io Docs](https://fly.io/docs/reference/regions) (pre-redirect)
- Base pricing for shared-cpu-1x 256 MB VM: $1.94/month in Ashburn; other regions have multipliers — [Fly.io Pricing](https://fly.io/pricing.md)
- Bandwidth in Asia/Africa/South America is $0.12/GB, more expensive than NA/EU — [StackScored](https://www.stackscored.com/pricing/dev-hosting/fly-io/)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Dockerfile |
| India region | Unclear: Mumbai (bom) was previously listed but not on current official page. Singapore is nearest confirmed. |
| Pricing | shared-cpu-1x, 256 MB: ~$1.94/month (Ashburn base). Dedicated 1 vCPU, 2 GB: ~$30-40/month (estimate with regional multiplier) |
| Free tier | Hobby plan: 3 shared VMs free, limited to 256 MB each |
| DPDP compliance | Uncertain; verify Mumbai availability with `fly platform regions` |

### Inferences
- Fly.io's region availability appears to be in flux. Run `fly platform regions` to check current Mumbai availability.
- Even if Mumbai is available, Fly.io's pricing for Asia regions with bandwidth costs may make it more expensive than it appears.

### Gaps
- Mumbai region availability is contradictory between sources. Direct verification needed.

---

## Coolify (Self-Hosted)

### Takeaway
Coolify is an open-source self-hosted PaaS that runs on any VPS, including Indian VPS providers. It supports .NET via Docker and gives full control over data residency.

### Cited Findings
- Coolify is an open-source, self-hosted PaaS that connects to a server over SSH, builds from a Git repo, and handles HTTPS via Traefik — [AutoGenius](https://new.autogenius.io/blog/install-coolify-vps-self-hosted-paas)
- Minimum specs: 2 GB RAM, 20 GB SSD; recommended: 4 GB RAM, 40 GB+ SSD for production — [GrowwStacks](https://growwstacks.com/blog/coolify-v4-self-hosting-nextjs-ollama-n8n/)
- Coolify builds via Nixpacks or Dockerfiles — [Various guides]
- Indian VPS providers (e.g., DigitalOcean BLR1, Hetzner via Ashburn, or local providers) can host Coolify — [DEV Community](https://dev.to/nikita_heroxhost_932ba998/best-coolify-vps-hosting-provider-in-india-2n4b)

### Platform Details
| Attribute | Detail |
|---|---|
| .NET support | Yes, via Dockerfile |
| India region | Yes, if hosted on an Indian VPS (DigitalOcean BLR1, AWS Mumbai EC2, Azure India VM, or local providers) |
| Pricing | Coolify itself is free (open-source). VPS cost: ~$6-24/month for 1-2 vCPU, 2-4 GB RAM on DigitalOcean/AWS |
| Free tier | Software is free; VPS cost is the only expense |
| DPDP compliance | Yes, full control over data location |

### Inferences
- Coolify is the most cost-effective option for a startup willing to manage infrastructure.
- The trade-off is operational overhead: you manage OS updates, backups, SSL certificates (automated via Traefik), and scaling yourself.
- A good middle-ground: Coolify on a DigitalOcean Droplet in BLR1 gives you a Heroku-like experience at VPS prices with Indian data residency.

### Gaps
- No tutorials or benchmarks for deploying ASP.NET Core specifically on Coolify were found.

---

# Summary Comparison Table

| Platform | .NET Support | India Region | Min Monthly Cost (1 vCPU, 2 GB) | Free Tier | DPDP Compliant |
|---|---|---|---|---|---|
| **Railway** | Docker | No (Singapore) | ~$15-25 | $5 trial | No |
| **Render** | Docker | No (Singapore) | ~$25 | Yes (spin-down) | No |
| **Azure App Service** | Native | Yes (3 regions) | ~$13 (Basic B1) | Yes (F1) | Yes |
| **Azure Container Apps** | Docker | Yes (3 regions) | ~$0 (free grant) to ~$63 | Yes (generous) | Yes |
| **AWS Fargate** | Docker | Yes (Mumbai, Hyderabad) | ~$35-45 | No (Fargate) | Yes |
| **Google Cloud Run** | Docker | Yes (Mumbai, Delhi) | ~$0 (free tier) to ~$55 | Yes (generous) | Yes |
| **DigitalOcean** | Docker | Droplets: Yes (BLR1) | ~$12 (Droplet) | Static only | Likely |
| **Fly.io** | Docker | Uncertain (bom) | ~$15-30 | 3 small VMs | Uncertain |
| **Coolify (self-hosted)** | Docker | Yes (any Indian VPS) | ~$6-24 (VPS cost) | Software free | Yes |

# Recommendation for CasaFit

For a 15-minute home-workout app targeting India with DPDP Act data residency requirements:

1. **Best overall: Azure Container Apps** — Free tier covers early development, first-class .NET support, three India regions, startup credits available, and scales with the business.
2. **Best budget option: Coolify on DigitalOcean BLR1** — ~$12/month for a capable setup with full data residency control.
3. **Best serverless: Google Cloud Run (Mumbai)** — Generous free tier, scale-to-zero, simple deployment, two India regions.
4. **Best flexibility: AWS Fargate (Mumbai)** — Full AWS ecosystem, ARM savings, but more complex setup.

Platforms without India regions (Railway, Render) should be excluded if DPDP Act compliance is required.
