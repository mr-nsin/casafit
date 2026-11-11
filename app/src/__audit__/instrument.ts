// Observation helpers: what changed after a press. Nothing here changes behaviour.

import { Alert, Linking, Share } from 'react-native';

import { useAuth } from '../state/auth';
import { useConsent } from '../state/consent';
import { useOnboarding } from '../state/onboardingDraft';
import { usePreferences } from '../state/preferences';
import { useVerifyOutcome } from '../features/onboarding/flowState';
import { useEditDraft } from '../features/session/browse/editing';
import { useSessionStore } from '../features/session/store';
import { useTrialNotice } from '../features/session/trial';
import { useFormCheck } from '../features/formcheck/controller';
import { useEntitlements } from '../features/formcheck/entitlements';
import { useBout } from '../features/steps/reverseStore';

/** Every zustand store in the app. A new store must be added here, or presses that only change it look like no-ops. */
const STORES: Record<string, { getState(): unknown }> = {
  auth: useAuth,
  consent: useConsent,
  onboarding: useOnboarding,
  preferences: usePreferences,
  verifyOutcome: useVerifyOutcome,
  editDraft: useEditDraft,
  session: useSessionStore,
  trialNotice: useTrialNotice,
  formCheck: useFormCheck,
  entitlements: useEntitlements,
  bout: useBout,
};

export function snapshotStores(): string {
  const out: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(STORES)) {
    try {
      out[name] = JSON.parse(
        JSON.stringify(s.getState(), (_k, v) => (typeof v === 'function' ? undefined : typeof v === 'bigint' ? String(v) : v)),
      );
    } catch {
      out[name] = 'unserialisable';
    }
  }
  return JSON.stringify(out);
}

/** The names of the stores whose state differs between two snapshots. */
export function changedStores(before: string, after: string): string[] {
  const a = JSON.parse(before) as Record<string, unknown>;
  const b = JSON.parse(after) as Record<string, unknown>;
  return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export interface CallLog {
  /** Calls that look like writes or side effects, e.g. "repos.food.insert". */
  effects: string[];
  /** Calls that only read, kept for the report. */
  reads: string[];
}

export const callLog: CallLog = { effects: [], reads: [] };
export const resetCalls = (): void => {
  callLog.effects.length = 0;
  callLog.reads.length = 0;
};

const READ_NAME = /^(get|list|find|load|count|all|days|byDate|between|since|latest|recent|search|read|has|is|peek|pending|due|fetch|query|today|week|range|for[A-Z]|active|saved|unsynced|history|bouts|subscribe)/i;

/** Wraps an object so every method call is recorded under `label.method`. Reads and effects are told apart by name. */
export function recordCalls<T extends object>(label: string, target: T, opts: { allEffects?: boolean } = {}): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const v = Reflect.get(obj, prop, receiver);
      if (typeof prop !== 'string') return v;
      if (typeof v === 'function') {
        return (...args: unknown[]) => {
          const name = `${label}.${prop}`;
          (opts.allEffects || !READ_NAME.test(prop) ? callLog.effects : callLog.reads).push(name);
          return v.apply(obj, args);
        };
      }
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
        return recordCalls(`${label}.${prop}`, v as object, opts);
      }
      return v;
    },
  });
}

/** Replaces the system hand-offs with recorders. Returns the restore function. */
export function spyOnSystem(): () => void {
  const originals = { alert: Alert.alert, share: Share.share, openURL: Linking.openURL, openSettings: Linking.openSettings, canOpen: Linking.canOpenURL };
  Alert.alert = ((...a: unknown[]) => {
    callLog.effects.push(`Alert.alert(${String(a[0])})`);
  }) as typeof Alert.alert;
  Share.share = (async (...a: unknown[]) => {
    callLog.effects.push(`Share.share(${JSON.stringify(a[0] ?? '').slice(0, 40)})`);
    return { action: 'dismissedAction' };
  }) as typeof Share.share;
  Linking.openURL = (async (url: string) => {
    callLog.effects.push(`Linking.openURL(${url})`);
    return true;
  }) as unknown as typeof Linking.openURL;
  Linking.openSettings = (async () => {
    callLog.effects.push('Linking.openSettings()');
  }) as typeof Linking.openSettings;
  Linking.canOpenURL = (async () => true) as typeof Linking.canOpenURL;
  return () => {
    Alert.alert = originals.alert;
    Share.share = originals.share;
    Linking.openURL = originals.openURL;
    Linking.openSettings = originals.openSettings;
    Linking.canOpenURL = originals.canOpen;
  };
}

export interface ConsoleCapture {
  errors: string[];
  warnings: string[];
  restore(): void;
}

const ACT_NOISE = /not wrapped in act|not configured to support act|A suspended resource finished loading inside a test/;

/** Records console.error and console.warn text so the audit can report what a press logged. */
export function captureConsole(): ConsoleCapture {
  const errors: string[] = [];
  const warnings: string[] = [];
  const e = console.error;
  const w = console.warn;
  const text = (a: unknown[]) => a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : String(x))).join(' ').slice(0, 300);
  console.error = (...a: unknown[]) => {
    const t = text(a);
    if (!ACT_NOISE.test(t)) errors.push(t);
  };
  console.warn = (...a: unknown[]) => {
    const t = text(a);
    if (!ACT_NOISE.test(t)) warnings.push(t);
  };
  return {
    errors,
    warnings,
    restore() {
      console.error = e;
      console.warn = w;
    },
  };
}
