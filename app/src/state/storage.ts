import type { Repositories } from '../db/repositories';

/**
 * Where the stores find their repositories. The app calls setRepositories once
 * at start-up (after migrations); tests pass an in-memory stand-in.
 */
let current: Repositories | null = null;

export function setRepositories(r: Repositories | null): void {
  current = r;
}

export function getRepositories(): Repositories {
  if (!current) throw new Error('Local database is not ready: call setRepositories first');
  return current;
}

export function hasRepositories(): boolean {
  return current !== null;
}
