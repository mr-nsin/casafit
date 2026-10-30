#!/usr/bin/env node
// Mints a Supabase-shaped access token (HS256) for local development, so the app can talk to the local API
// without a Supabase project. Never use it outside development: the secret below is the public docker-compose one.
//
//   node api/tools/mint-dev-token.mjs                       prints the token
//   node api/tools/mint-dev-token.mjs --email me@x.test --days 3
//   node api/tools/mint-dev-token.mjs --url https://dev-project.supabase.co --secret <Supabase__JwtSecret>
//
// Put the output in app/.env.local as EXPO_PUBLIC_DEV_AUTH_TOKEN=<token>. The API must run with the same
// Supabase__JwtSecret and Supabase__Url (the issuer is <url>/auth/v1). Defaults match api/docker-compose.yml.

import { createHmac, randomUUID } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1]]] : [])),
);

const secret = args.secret ?? process.env.SUPABASE_JWT_SECRET ?? 'local-compose-supabase-jwt-secret-0123456789';
const url = (args.url ?? process.env.SUPABASE_URL ?? 'https://your-project.supabase.co').replace(/\/+$/, '');
const email = (args.email ?? 'dev@casafit.test').toLowerCase();
const days = Number(args.days ?? 7);
// A fixed id keeps the same local account between runs. Pass --sub to try a different one.
const sub = args.sub ?? '00000000-0000-4000-8000-000000000001';

if (!Number.isFinite(days) || days <= 0) {
  console.error('--days must be a positive number');
  process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'HS256', typ: 'JWT' };
const claims = {
  sub,
  email,
  aud: 'authenticated',
  role: 'authenticated',
  iss: `${url}/auth/v1`,
  iat: now,
  exp: now + Math.round(days * 86400),
  session_id: randomUUID(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
};
const input = `${b64(header)}.${b64(claims)}`;
const token = `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;

console.log(token);
console.error(`sub ${claims.sub}, ${email}, issuer ${claims.iss}, expires ${new Date(claims.exp * 1000).toISOString()}`);
