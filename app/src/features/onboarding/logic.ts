// Pure rules for the onboarding screens. No React, no storage: easy to test.

import type { OnboardingDraft } from '../../db/repositories';
import type { BodyPart, Experience, HealthFlag, PainArea, Sex, Style } from '../../engine';

export const MIN_AGE = 18;

export function ageFrom(birthYear: number, thisYear: number): number {
  return thisYear - birthYear;
}
export const isAdult = (birthYear: number | null, thisYear: number): boolean =>
  birthYear !== null && ageFrom(birthYear, thisYear) >= MIN_AGE;

/** Years offered on Age: from last year back 100 years, so an under-18 answer is possible. */
export function birthYearOptions(thisYear: number): number[] {
  return Array.from({ length: 100 }, (_, i) => thisYear - 1 - i);
}

export function canContinueAge(d: Pick<OnboardingDraft, 'birthYear' | 'confirmed18'>, thisYear: number): boolean {
  return isAdult(d.birthYear, thisYear) && d.confirmed18;
}

export const BODY_PART_OPTIONS: { value: BodyPart; label: string }[] = [
  { value: 'arms', label: 'Arms' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'core', label: 'Core' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'legs', label: 'Legs' },
];
export const MAX_BODY_PARTS = 2;

export const STYLE_OPTIONS: { value: Style; label: string; icon: string; blurb: string }[] = [
  { value: 'normal', label: 'Normal', icon: 'self_improvement', blurb: 'Strength and HIIT-style circuits' },
  { value: 'dance', label: 'Dance', icon: 'music_note', blurb: 'Follow-along cardio routines' },
  { value: 'yoga', label: 'Yoga', icon: 'spa', blurb: 'Flows and gentle holds' },
];

export function canContinueGoals(d: Pick<OnboardingDraft, 'goal' | 'bodyParts' | 'styles'>): boolean {
  if (!d.goal || d.styles.length < 1) return false;
  if (d.goal === 'body_part') return d.bodyParts.length >= 1 && d.bodyParts.length <= MAX_BODY_PARTS;
  return true;
}

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'other', label: 'Other' },
];
export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'on_and_off', label: 'On and off' },
  { value: 'regular', label: 'Regular' },
];
export const PAIN_OPTIONS: { value: PainArea | 'none'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'knees', label: 'Knees' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'wrists', label: 'Wrists' },
  { value: 'other', label: 'Other' },
];
export const HEALTH_OPTIONS: { value: HealthFlag | 'none'; label: string }[] = [
  { value: 'heart_bp', label: 'Heart or BP' },
  { value: 'pregnancy', label: 'Pregnancy or postpartum' },
  { value: 'recent_surgery', label: 'Recent surgery' },
  { value: 'none', label: 'None' },
];

/** Height and weight are optional. Empty is fine; a filled value must be in range. */
export function parseHeight(raw: string): { value: number | null; error?: string } {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 80 || n > 260) return { value: null, error: 'Enter a height between 80 and 260 cm, or skip.' };
  return { value: Math.round(n) };
}
export function parseWeight(raw: string): { value: number | null; error?: string } {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 20 || n > 300) return { value: null, error: 'Enter a weight between 20 and 300 kg, or skip.' };
  return { value: Math.round(n * 10) / 10 };
}

/** Even split of the training days across the chosen styles. First styles get the extra days. */
export function defaultMix(styles: readonly Style[], days: number): Partial<Record<Style, number>> {
  const out: Partial<Record<Style, number>> = {};
  if (styles.length === 0) return out;
  const base = Math.floor(days / styles.length);
  let extra = days - base * styles.length;
  for (const s of styles) {
    out[s] = base + (extra > 0 ? 1 : 0);
    extra = Math.max(0, extra - 1);
  }
  return out;
}
export const mixTotal = (mix: Partial<Record<Style, number>>, styles: readonly Style[]): number =>
  styles.reduce((a, s) => a + (mix[s] ?? 0), 0);

/** Where About goes next (D4): Mix for three styles, else Health for any flag, else Building. */
export type AfterAbout = 'Mix' | 'Health' | 'Building';
export function nextAfterAbout(d: Pick<OnboardingDraft, 'styles' | 'healthFlags'>): AfterAbout {
  if (d.styles.length === 3) return 'Mix';
  return d.healthFlags.length > 0 ? 'Health' : 'Building';
}
export function nextAfterMix(d: Pick<OnboardingDraft, 'healthFlags'>): 'Health' | 'Building' {
  return d.healthFlags.length > 0 ? 'Health' : 'Building';
}
export function backFromHealth(d: Pick<OnboardingDraft, 'styles'>): 'Mix' | 'About' {
  return d.styles.length === 3 ? 'Mix' : 'About';
}

const FLAG_PHRASE: Record<HealthFlag, string> = {
  heart_bp: 'your heart or blood pressure',
  pregnancy: 'pregnancy or postpartum',
  recent_surgery: 'your recent surgery',
};

export function healthIntro(flags: readonly HealthFlag[]): string {
  const parts = flags.map((f) => FLAG_PHRASE[f]);
  const list = parts.length <= 1 ? (parts[0] ?? 'your health') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `You told us about ${list}. We start slower so your body can settle in.`;
}

export function formatClock(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
