// Dependency seams for the nutrition lane. Defaults are the real content, repositories and clock.
// Tests call configureNutritionDeps with fixed values.

import { loadContent, type Content } from '../../content';
import type { Repositories } from '../../db/repositories';
import { addDays, localDateKey } from '../../engine';
import { getRepositories } from '../../state/storage';

export interface NutritionDeps {
  content: () => Content;
  repos: () => Repositories;
  now: () => Date;
  newId: () => string;
}

const defaults: NutritionDeps = {
  content: () => loadContent(),
  repos: () => getRepositories(),
  now: () => new Date(),
  newId: () => `fe_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
};

let deps: NutritionDeps = defaults;

export function configureNutritionDeps(partial: Partial<NutritionDeps> | null): void {
  deps = partial ? { ...deps, ...partial } : defaults;
}

export const getNutritionDeps = (): NutritionDeps => deps;

/** Local calendar date key for "today". */
export function todayKey(d: Date = deps.now()): string {
  return localDateKey(d.getTime(), -d.getTimezoneOffset());
}
export const yesterdayKey = (): string => addDays(todayKey(), -1);
