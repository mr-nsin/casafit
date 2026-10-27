/**
 * D3: raw health answers never go to the server unless the user turned health
 * sync on. The queue refuses such bodies at enqueue time, so a bug in a caller
 * cannot leak them from here.
 */
const HEALTH_KEYS = new Set([
  'painareas', 'pain_areas', 'healthflags', 'health_flags', 'flags', 'heightcm', 'height_cm',
  'weightkg', 'weight_kg', 'waistcm', 'waist_cm', 'sex', 'birthyear', 'birth_year',
  'healthconsent', 'confirmed18', 'allergies', 'allergyother', 'frames', 'landmarks',
]);

export class HealthDataLeakError extends Error {
  constructor(public readonly key: string) {
    super(`Refusing to queue health field "${key}" without health sync (D3)`);
    this.name = 'HealthDataLeakError';
  }
}

export function findHealthKey(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const f = findHealthKey(v, depth + 1);
      if (f) return f;
    }
    return null;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (HEALTH_KEYS.has(k.toLowerCase())) return k;
    const f = findHealthKey(v, depth + 1);
    if (f) return f;
  }
  return null;
}

export function assertNoRawHealth(body: unknown, healthSyncOn: boolean): void {
  if (healthSyncOn) return;
  const k = findHealthKey(body);
  if (k) throw new HealthDataLeakError(k);
}
