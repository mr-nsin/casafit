// `npm run audit`: runs the tap-every-control audit and writes app/audit-report.json and docs/plans/ui-audit.md.
//   npm run audit -- --update-allowlist   also rewrites src/__audit__/allowlist.json from today's findings
//   AUDIT_ONLY=<regex> npm run audit      one screen or a few (prints a table, writes nothing)
const { spawnSync } = require('child_process');

const env = { ...process.env, AUDIT_RUN: '1' };
if (!env.AUDIT_ONLY) env.AUDIT_WRITE = '1';
if (process.argv.includes('--update-allowlist')) env.AUDIT_UPDATE_ALLOWLIST = '1';

const r = spawnSync('npx', ['jest', 'src/__audit__/audit.test.tsx', '--testTimeout=240000', '--runInBand'], { stdio: 'inherit', env, shell: true });
process.exit(r.status ?? 1);
