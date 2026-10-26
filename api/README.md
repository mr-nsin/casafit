# CasaFit · api

ASP.NET Core Web API on .NET 10 LTS (C#), EF Core + Npgsql over Postgres, Redis for OTPs and rate limits, Hangfire for background jobs.

See `docs/tech-stack.md` §2 and §3, `docs/architecture.md` §3 and the 2026-10-26 entry in `docs/decisions.md`.

> **Status: port pending.** The code currently in this folder (`src/`, `test/`, `prisma/`, `package.json`) is the earlier NestJS + Prisma scaffold. The backend is now ASP.NET Core, so that scaffold is to be ported to the solution below and then deleted, along with the `api` entry in `pnpm-workspace.yaml`. Do not add features to it. The first slice to port is `POST /v1/auth/code` and `POST /v1/auth/verify` (plan task 7 in `docs/plans/onboarding.md`).

## Target layout

```
api/
  CasaFit.sln
  Directory.Packages.props        central NuGet versions
  src/
    CasaFit.Domain/               entities, value objects, no dependencies
    CasaFit.Application/          services, validators, idempotency, identifier normalisation
    CasaFit.Infrastructure/       EF Core DbContext + migrations, Redis, SMS / RevenueCat / store clients
    CasaFit.Api/                  controllers, Program.cs, auth, rate limiting, OpenAPI
  tests/
    CasaFit.UnitTests/            xUnit + NSubstitute
    CasaFit.IntegrationTests/     WebApplicationFactory + Testcontainers (Postgres)
```

Each module (`Auth`, `Accounts`, `Entitlements`, `Content`, `Analytics`, `Admin`) is a feature folder in every project that needs it.

## Dev (once ported)

```bash
cd api
dotnet restore
dotnet ef database update --project src/CasaFit.Infrastructure --startup-project src/CasaFit.Api
dotnet run --project src/CasaFit.Api
dotnet test
```

OpenAPI document: `http://localhost:5080/openapi/v1.json`. The build writes it to `api/openapi.json`; `shared/` generates the app's request and response types from that file.
