// Local reminder service. Reminders are scheduled on the phone with expo-notifications (one
// per weekday slot) because the preview text comes from the on-device plan. The native module
// is required lazily so importing this file is safe in Jest and before the module is installed.
// One channel, `daily_reminder`; no streak or missed-workout nudges (design: no guilt).

export type OsPermission = 'granted' | 'denied' | 'undetermined';

export interface ReminderContent {
  /** Title of the weekday nudge, for example "Core + Glutes is ready". */
  title: string;
  body: string;
}

export interface ReminderSchedule {
  /** 'HH:mm' local. */
  time: string;
  sundayRecap: boolean;
  weekday: ReminderContent;
  recap: ReminderContent;
}

export interface NotificationService {
  getPermission(): Promise<OsPermission>;
  /** Shows the OS prompt (Android 13+ POST_NOTIFICATIONS). Call only after the user taps Allow. */
  requestPermission(): Promise<OsPermission>;
  /** Replaces every scheduled reminder. */
  schedule(s: ReminderSchedule): Promise<void>;
  cancelAll(): Promise<void>;
  openSystemSettings(): Promise<void>;
}

export const CHANNEL_ID = 'daily_reminder';

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h! : 7, minute: Number.isFinite(m) ? m! : 30 };
}

/** The slots to schedule: expo weekday 1 = Sunday ... 7 = Saturday. Sunday carries the recap when it is on. */
export function reminderSlots(s: ReminderSchedule): { weekday: number; content: ReminderContent }[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    content: weekday === 1 && s.sundayRecap ? s.recap : s.weekday,
  }));
}

declare const require: (id: string) => any;

interface ExpoNotifications {
  getPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean; status?: string }>;
  requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean; status?: string }>;
  setNotificationChannelAsync(id: string, c: Record<string, unknown>): Promise<unknown>;
  scheduleNotificationAsync(r: Record<string, unknown>): Promise<string>;
  cancelAllScheduledNotificationsAsync(): Promise<void>;
  AndroidImportance: { DEFAULT: number };
  SchedulableTriggerInputTypes: { WEEKLY: string };
}

export function createExpoNotificationService(load: () => ExpoNotifications = () => require('expo-notifications')): NotificationService {
  let lib: ExpoNotifications | null = null;
  const get = () => (lib ??= load());
  const platform = (): string => {
    try {
      return require('react-native').Platform.OS;
    } catch {
      return 'ios';
    }
  };
  const ensureChannel = async () => {
    // Android 13 needs the channel to exist before the permission prompt.
    if (platform() === 'android') {
      await get().setNotificationChannelAsync(CHANNEL_ID, { name: 'Daily reminder', importance: get().AndroidImportance.DEFAULT });
    }
  };
  return {
    async getPermission() {
      try {
        const r = await get().getPermissionsAsync();
        return r.granted ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined';
      } catch {
        return 'undetermined';
      }
    },
    async requestPermission() {
      await ensureChannel();
      const r = await get().requestPermissionsAsync();
      return r.granted ? 'granted' : 'denied';
    },
    async schedule(s) {
      const n = get();
      await ensureChannel();
      await n.cancelAllScheduledNotificationsAsync();
      const { hour, minute } = parseTime(s.time);
      for (const slot of reminderSlots(s)) {
        await n.scheduleNotificationAsync({
          content: { title: slot.content.title, body: slot.content.body },
          trigger: { type: n.SchedulableTriggerInputTypes.WEEKLY, weekday: slot.weekday, hour, minute, channelId: CHANNEL_ID },
        });
      }
    },
    async cancelAll() {
      try {
        await get().cancelAllScheduledNotificationsAsync();
      } catch {
        /* module not available: nothing was scheduled */
      }
    },
    async openSystemSettings() {
      const { Linking } = require('react-native');
      await Linking.openSettings();
    },
  };
}

export interface FakeNotificationService extends NotificationService {
  permission: OsPermission;
  /** What the OS prompt answers. */
  promptAnswer: OsPermission;
  scheduled: ReminderSchedule[];
  prompts: number;
  cancelled: number;
  settingsOpened: number;
}

export function createFakeNotificationService(initial: OsPermission = 'undetermined', promptAnswer: OsPermission = 'granted'): FakeNotificationService {
  const f: FakeNotificationService = {
    permission: initial,
    promptAnswer,
    scheduled: [],
    prompts: 0,
    cancelled: 0,
    settingsOpened: 0,
    async getPermission() {
      return f.permission;
    },
    async requestPermission() {
      f.prompts += 1;
      f.permission = f.promptAnswer;
      return f.permission;
    },
    async schedule(s) {
      f.scheduled.push(s);
    },
    async cancelAll() {
      f.cancelled += 1;
    },
    async openSystemSettings() {
      f.settingsOpened += 1;
    },
  };
  return f;
}

let current: NotificationService | null = null;
export function setNotificationService(s: NotificationService | null): void {
  current = s;
}
export function getNotificationService(): NotificationService {
  return (current ??= createExpoNotificationService());
}
