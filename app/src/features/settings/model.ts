// Pure helpers for the settings lane: time labels, language list, FAQ, profile checks.

import type { PainArea, Profile } from '../../db/repositories';

/** 'HH:mm' to '7:30 am'. */
export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export const TIME_CHIPS = ['06:30', '07:30', '12:30', '18:00', '20:00'] as const;

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export interface LanguageOption {
  /** BCP 47 locale stored in Profile.locale. */
  id: string;
  native: string;
  english: string;
  /** English is the only language with strings today. */
  available: boolean;
  voice: boolean;
  isNew?: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'en-IN', native: 'English', english: 'English', available: true, voice: true },
  { id: 'hi-IN', native: 'हिन्दी', english: 'Hindi', available: false, voice: true, isNew: true },
  { id: 'ta-IN', native: 'தமிழ்', english: 'Tamil', available: false, voice: false },
  { id: 'te-IN', native: 'తెలుగు', english: 'Telugu', available: false, voice: false },
  { id: 'mr-IN', native: 'मराठी', english: 'Marathi', available: false, voice: false },
  { id: 'bn-IN', native: 'বাংলা', english: 'Bengali', available: false, voice: false },
];

export const languageFor = (locale: string | null | undefined): LanguageOption =>
  LANGUAGES.find((l) => l.id === locale) ?? LANGUAGES[0]!;

export const languageSubtitle = (l: LanguageOption): string =>
  l.id === 'en-IN'
    ? 'App and voice coach'
    : l.voice
      ? `${l.english} · app and voice coach`
      : `${l.english} · app only, voice coming soon`;

export const PAIN_AREAS: { value: PainArea; label: string }[] = [
  { value: 'knees', label: 'Knees' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'wrists', label: 'Wrists' },
];

export const painSummary = (areas: readonly PainArea[]): string =>
  areas.length === 0 ? 'None' : areas.map((a) => PAIN_AREAS.find((p) => p.value === a)?.label ?? a).join(', ');

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Me';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

export function parseBirthYear(raw: string, now: number = Date.now()): { value: number | null; error?: string } {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  const year = new Date(now).getFullYear();
  if (!Number.isInteger(n) || n < 1900 || n > year) return { value: null, error: 'Enter a four-digit year, like 1998.' };
  if (year - n < 18) return { value: null, error: 'CasaFit is for people aged 18 and over.' };
  return { value: n };
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  { id: 'checks', question: 'How do free form checks work?', answer: 'Every account gets 2 for its whole life. A check only counts after 3 analysed reps. Pro gives unlimited checks. Nothing is ever recorded: the camera is read on your phone and no frames leave it.' },
  { id: '15min', question: 'Why are sessions 15 minutes?', answer: 'A short session is easier to repeat. Each one is 2 minutes of warm-up, 11 minutes of work and 2 minutes of cool-down, so you start gently and finish calm.' },
  { id: 'plan', question: 'How is my plan built?', answer: 'Rules on your phone build it from your answers: your goal, the days you can train, your experience and any pain areas. Moves that could aggravate a pain area are left out. Change your answers any time from Edit profile.' },
  { id: 'cancel', question: 'How do I cancel Pro?', answer: 'Pro is billed by the Play Store or App Store, so you cancel there: open your store subscriptions, pick CasaFit and choose cancel. You keep Pro until the end of the period you paid for.' },
  { id: 'hurts', question: 'Something hurts. What should I do?', answer: 'Stop the move. Sharp or lasting pain is a reason to rest and ask a doctor or physiotherapist. You can add the area under Pain or past injury so future plans leave out moves that load it.' },
  { id: 'privacy', question: 'What do you do with my data?', answer: 'Your plan, logs and health answers stay on your phone unless you choose to sync. Each permission is separate and you can turn any of them off in Privacy and data. You can download or delete everything there too. Camera analysis stays on your phone.' },
];

export const SUPPORT_EMAIL = 'support@casafit.app';

export const supportMailto = (version: string): string =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`CasaFit ${version} support`)}`;

export const hasName = (p: Profile | null): boolean => !!p?.name?.trim();

/** Month and year such as "Oct 2026". */
export function sinceLabel(ms: number): string {
  const d = new Date(ms);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
}
