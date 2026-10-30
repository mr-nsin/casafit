// Seams for the form-check and Pro lane: network, queue, ids, clock, links, pose source and
// permission. Defaults are the real ones; Jest swaps in fakes with configureFormCheckDeps.

import { Linking } from 'react-native';

import { api } from '../../api/client';
import type { Repositories } from '../../db/repositories';
import { newId } from '../../services/offline-queue';
import type { QueueMethod } from '../../services/offline-queue';
import { getCameraPermission, getPoseSource, type CameraPermissionPort, type PoseSourceFactory } from '../../services/pose';
import { getRepositories } from '../../state/storage';

export interface QueueRequest {
  kind: string;
  method: QueueMethod;
  path: string;
  body?: unknown;
  idempotencyKey: string;
}

export interface FormCheckDeps {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** Adds a request to the offline queue under an existing idempotency key. */
  enqueue: (req: QueueRequest) => Promise<void>;
  /** Best-effort flush of the offline queue. Never rejects. */
  flush: () => Promise<void>;
  repos: () => Repositories;
  now: () => number;
  /** A uuid: attempt ids and idempotency keys. */
  newId: () => string;
  openSettings: () => Promise<void>;
  poseSource: PoseSourceFactory;
  permission: () => CameraPermissionPort;
}

const defaults = (): FormCheckDeps => ({
  api,
  enqueue: async () => undefined,
  flush: async () => undefined,
  repos: getRepositories,
  now: () => Date.now(),
  newId,
  openSettings: () => Linking.openSettings(),
  poseSource: (e) => getPoseSource(e),
  permission: getCameraPermission,
});

let current: FormCheckDeps = defaults();

export const getFormCheckDeps = (): FormCheckDeps => current;
export function configureFormCheckDeps(patch: Partial<FormCheckDeps> | null): void {
  current = patch ? { ...current, ...patch } : defaults();
}
