import { create } from 'zustand';
import { getRepositories } from './storage';

export interface SessionPrefs {
  voice: boolean;
  duck: boolean;
  lang: string;
  quiet: boolean;
  restS: 10 | 15 | 20 | 30;
}
export interface NotificationPrefs {
  enabled: boolean;
  time: string; // 'HH:mm' local
  sundayRecap: boolean;
}

export interface PreferenceValues {
  /** D7: one global switch. false hides every kcal surface. */
  showCalories: boolean;
  session: SessionPrefs;
  notifications: NotificationPrefs;
}

export const defaultPreferences = (): PreferenceValues => ({
  showCalories: true,
  session: { voice: true, duck: true, lang: 'en-IN', quiet: false, restS: 15 },
  notifications: { enabled: false, time: '07:30', sundayRecap: true },
});

const KEY = 'preferences.v1';

type State = PreferenceValues & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setShowCalories: (v: boolean) => Promise<void>;
  setSession: (patch: Partial<SessionPrefs>) => Promise<void>;
  setNotifications: (patch: Partial<NotificationPrefs>) => Promise<void>;
};

const pick = (s: State): PreferenceValues => ({
  showCalories: s.showCalories,
  session: s.session,
  notifications: s.notifications,
});

export const usePreferences = create<State>((set, get) => {
  const persist = () => getRepositories().prefs.set(KEY, JSON.stringify(pick(get())));
  return {
    ...defaultPreferences(),
    hydrated: false,
    async hydrate() {
      const raw = await getRepositories().prefs.get(KEY);
      const d = defaultPreferences();
      if (raw) {
        try {
          const p = JSON.parse(raw) as Partial<PreferenceValues>;
          set({
            showCalories: typeof p.showCalories === 'boolean' ? p.showCalories : d.showCalories,
            session: { ...d.session, ...p.session },
            notifications: { ...d.notifications, ...p.notifications },
          });
        } catch {
          /* corrupt value: keep defaults */
        }
      }
      set({ hydrated: true });
    },
    async setShowCalories(v) {
      set({ showCalories: v });
      await persist();
    },
    async setSession(patch) {
      set({ session: { ...get().session, ...patch } });
      await persist();
    },
    async setNotifications(patch) {
      set({ notifications: { ...get().notifications, ...patch } });
      await persist();
    },
  };
});

/** The single guard every kcal surface reads (Home, Nutrition, NutriPlan, FoodSearch, Meal). */
export const useShowCalories = (): boolean => usePreferences((s) => s.showCalories);
