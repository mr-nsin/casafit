# CasaFit · api

NestJS 10 on Node.js 20, Prisma over Postgres, Redis for OTPs and rate limits.

See `docs/tech-stack.md` §2 and `docs/architecture.md` §3.

## Dev

```bash
cp .env.example .env
pnpm install
pnpm --filter @casafit/api prisma:generate
pnpm --filter @casafit/api prisma:migrate
pnpm --filter @casafit/api start:dev
```

OpenAPI docs: http://localhost:3000/v1/docs

## Layout

- `src/main.ts` — bootstrap, global prefix, validation pipe, Swagger.
- `src/app.module.ts` — root module.
- `src/modules/<name>/` — one Nest module per capability.
- `src/prisma/` — the generated client, DI wrapper.
- `src/common/` — small shared helpers (idempotency, auth guard, request IDs).
- `test/` — Supertest e2e specs; unit tests sit next to the file as `.spec.ts`.
