// Cold-start wiring. One place that opens the database, hydrates the stores and hands every
// lane its dependencies. Every native or network piece is injectable so Jest can run it with fakes.

import { ApiError, api } from '../api/client';
import { openAppDatabase, type Repositories, type SqlDriver } from '../db';
import { buildTimeline } from '../engine';
import { configureNutritionDeps } from '../features/nutrition';
import { configureOnboardingDeps, type ServerPlanBody } from '../features/onboarding';
import { configureSessionDeps, startSession, type ContentPort, type SessionPlan } from '../features/session';
import { loadContent, type Content } from '../content';
import { createCueService, createExpoBackends } from '../services/audio-cues';
import { createExpoKeepAwake } from '../services/keep-awake';
import {
  idempotencyHeaders,
  newId,
  OfflineQueue,
  type QueueItem,
  type QueueSender,
} from '../services/offline-queue';
import { createPlatformStepCounter, setStepCounter, type StepCounterService } from '../services/step-counter';
import { useAuth } from '../state/auth';
import { useConsent } from '../state/consent';
import { useOnboarding } from '../state/onboardingDraft';
import { usePreferences } from '../state/preferences';
import { setRepositories } from '../state/storage';
import { exerciseIcon } from '../features/session/icons';

/** Everything bootstrap touches outside this file. Defaults are the real thing. */
export interface BootstrapIO {
  /** Opens and migrates the on-device database. */
  openDatabase(): Promise<{ driver: SqlDriver; repos: Repositories }>;
  hydrateAuth(): Promise<void>;
  isOnline(): Promise<boolean>;
  /** Sends one queued request; resolves with the HTTP status, throws on a network failure. */
  send: QueueSender;
  stepCounter(): StepCounterService;
  cueBackends: typeof createExpoBackends;
  keepAwake: typeof createExpoKeepAwake;
  content(): Content;
  openPrivacyNotice(): void;
}

async function netInfoOnline(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo').default as {
      fetch(): Promise<{ isConnected: boolean | null }>;
    };
    return (await NetInfo.fetch()).isConnected !== false;
  } catch {
    return true;
  }
}

const apiSender: QueueSender = async (item: QueueItem) => {
  try {
    await api(item.path, {
      method: item.method,
      headers: idempotencyHeaders(item),
      body: item.body === undefined ? undefined : JSON.stringify(item.body),
    });
    return { status: 200 };
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status };
    throw e;
  }
};

export function realIO(): BootstrapIO {
  return {
    openDatabase: () => openAppDatabase(),
    hydrateAuth: () => useAuth.getState().hydrate(),
    isOnline: netInfoOnline,
    send: apiSender,
    stepCounter: () => createPlatformStepCounter(),
    cueBackends: createExpoBackends,
    keepAwake: createExpoKeepAwake,
    content: () => loadContent(),
    openPrivacyNotice() {
      // The Privacy screen belongs to the settings lane; until it exists this is a no-op.
    },
  };
}

function contentPort(content: () => Content): ContentPort {
  return {
    exercise(id) {
      const c = content();
      const ex = c.exercise(id);
      if (!ex) return null;
      return {
        id: ex.id,
        cue: c.t(ex.cueKey),
        alt: c.t(ex.demo.altKey),
        icon: exerciseIcon(ex),
        breath: ex.breath,
        bpm: ex.bpm,
        voiceClips: ex.voiceClips,
      };
    },
  };
}

export interface BootstrapResult {
  repos: Repositories;
  queue: OfflineQueue;
  /** Best-effort flush of the offline queue; never rejects. */
  flushQueue(): Promise<void>;
}

/**
 * Opens the database (which also runs migrations), publishes the repositories, hydrates the
 * stores and configures each lane. Throws only if the database cannot be opened; the caller
 * shows a recoverable error screen. Hydration and service failures degrade to defaults.
 */
export async function bootstrap(overrides: Partial<BootstrapIO> = {}): Promise<BootstrapResult> {
  const io: BootstrapIO = { ...realIO(), ...overrides };

  const { driver, repos } = await io.openDatabase();
  setRepositories(repos);

  // A failed hydrate leaves that store on its defaults: the app still opens.
  await Promise.all([
    usePreferences.getState().hydrate(),
    useOnboarding.getState().hydrate(),
    useConsent.getState().hydrate(),
    io.hydrateAuth(),
  ].map((p) => p.catch(() => undefined)));

  const queue = new OfflineQueue(driver, {
    healthSyncOn: () => useConsent.getState().has('steps'),
  });
  const flushQueue = async () => {
    try {
      const res = await queue.flush(io.send);
      if (res.sent > 0) await repos.plan.markSynced(Date.now());
    } catch {
      /* offline: the items stay queued */
    }
  };

  configureOnboardingDeps({
    isOnline: io.isOnline,
    async syncPlan(body: ServerPlanBody) {
      await queue.enqueue({
        kind: 'plan.put',
        method: 'PUT',
        path: '/me/plan',
        body,
        idempotencyKey: newId(),
      });
      void flushQueue();
    },
    startToday(day) {
      if (!day.session) return null;
      return startSession(day.session as SessionPlan);
    },
    openPrivacyNotice: io.openPrivacyNotice,
  });

  configureSessionDeps({
    // The session lane's PlanStep omits muscles/stretches, which the engine's timeline never reads.
    buildTimeline: (plan, opts) => buildTimeline(plan as Parameters<typeof buildTimeline>[0], opts),
    cues: createCueService({
      ...io.cueBackends(),
      resolveClip: (cue, lang) => {
        if (!cue.exerciseId) return null;
        return contentPort(io.content).exercise(cue.exerciseId)?.voiceClips?.[lang] ?? null;
      },
    }),
    keepAwake: io.keepAwake(),
    snapshot: repos.snapshot,
    sessionLog: { insert: (log) => repos.sessionLog.insert(log) },
    micro: repos.micro,
    prefs: {
      async load() {
        return usePreferences.getState().session;
      },
      async save(prefs) {
        await usePreferences.getState().setSession(prefs);
      },
    },
    content: contentPort(io.content),
    newId,
  });

  configureNutritionDeps({ repos: () => repos, content: io.content });

  try {
    setStepCounter(io.stepCounter());
  } catch {
    /* no sensor library: the steps lane shows its own unavailable state */
  }

  void flushQueue();
  return { repos, queue, flushQueue };
}
