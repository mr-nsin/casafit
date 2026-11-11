// Keeps the audit honest: every registered route has at least one scenario, and the route spec matches the route map.

import { implementedRootRoutes, rootRouteLanes, tabRouteLanes } from '../app/routes';
import { ALLOWED_PARAMS, KNOWN_ROUTES, REQUIRED_PARAMS, validateNavCalls } from './routeSpec';
import { scenarios, screens, tabScreens } from './scenarios';
import allowlist from './allowlist.json';

jest.mock('@react-navigation/native', () => require('./navMock').navigationModule);

describe('audit coverage', () => {
  it('has a scenario for every implemented stack route and every tab', () => {
    const covered = new Set(scenarios.map((s) => s.screen));
    const missing = [...implementedRootRoutes, ...Object.keys(tabRouteLanes)].filter((r) => !covered.has(r));
    expect(missing).toEqual([]);
  });

  it('knows a component for every implemented route and no extra ones', () => {
    expect(Object.keys(screens).sort()).toEqual([...implementedRootRoutes].sort());
    expect(Object.keys(tabScreens).sort()).toEqual(Object.keys(tabRouteLanes).sort());
  });

  it('gives every scenario a unique id', () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the route spec in step with the route map', () => {
    expect(KNOWN_ROUTES.has('Main')).toBe(true);
    for (const name of [...Object.keys(REQUIRED_PARAMS), ...Object.keys(ALLOWED_PARAMS)]) expect(KNOWN_ROUTES.has(name)).toBe(true);
    for (const name of Object.keys(rootRouteLanes)) expect(KNOWN_ROUTES.has(name)).toBe(true);
  });

  it('catches an unregistered route, a missing param and a stray param', () => {
    const problems = validateNavCalls([
      { method: 'navigate', args: ['Nowhere'] },
      { method: 'navigate', args: ['BodyPart'] },
      { method: 'navigate', args: ['Plan', { day: 'x' }] },
      { method: 'navigate', args: ['Exercise', { exerciseId: 'squat' }] },
      { method: 'reset', args: [{ index: 0, routes: [{ name: 'Main' }] }] },
    ]);
    expect(problems.map((p) => p.problem)).toEqual([
      'route "Nowhere" is not registered',
      'missing required param "part"',
      'unexpected param "day" for Plan',
    ]);
  });

  it('keeps the allowlist well formed', () => {
    const keys = (allowlist as { key: string; note: string }[]).map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of allowlist as { key: string; note: string }[]) {
      expect(a.key.split(' | ')).toHaveLength(3);
      expect(a.note.length).toBeGreaterThan(0);
    }
  });
});
