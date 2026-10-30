// Seams for the settings lane: network, share sheet and links. Defaults are the real ones;
// Jest swaps in fakes with configureSettingsDeps.

import { Linking, Share } from 'react-native';

import { api } from '../../api/client';

export interface SettingsDeps {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** Hands a file's text to the system share sheet. */
  share: (opts: { title: string; message: string }) => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  now: () => number;
}

const defaults = (): SettingsDeps => ({
  api,
  share: async ({ title, message }) => {
    await Share.share({ title, message });
  },
  openUrl: (url) => Linking.openURL(url),
  now: () => Date.now(),
});

let current: SettingsDeps = defaults();

export const getSettingsDeps = (): SettingsDeps => current;
export function configureSettingsDeps(patch: Partial<SettingsDeps> | null): void {
  current = patch ? { ...current, ...patch } : defaults();
}
