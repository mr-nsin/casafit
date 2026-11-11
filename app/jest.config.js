// The tap-every-control audit (src/__audit__/audit.test.tsx) renders every screen and presses every control,
// which takes about five minutes, so the normal suite skips it. `npm run audit` turns it on.
const auditRun = process.env.AUDIT_RUN === '1';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', ...(auditRun ? [] : ['/__audit__/audit\.test\.tsx$'])],
};
