// Pure nutrition logic: totals, slot defaults, portion steps, plan generation, targets.

import type { Content } from '../../content';
import type { FoodItem, FoodUnitName, Nutrients } from '../../content/types';
import type { FoodEntry, Meal, NutritionProfile, Profile } from '../../db/repositories';
import { computeNutritionTargets, splitMeals, type NutritionResult, type ProteinStatus } from '../../engine';

export const SLOTS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const SLOT_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner', other: 'Other' };
export const SLOT_TIME: Record<Meal, string> = { breakfast: '8 am', lunch: '1 pm', snack: '5 pm', dinner: '8 pm', other: '' };

export function slotForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

export const asSlot = (s: string | undefined, hour: number): Meal =>
  s && (SLOTS as string[]).concat('other').includes(s) ? (s as Meal) : slotForHour(hour);

export interface Totals {
  kcal: number;
  proteinG: number;
  portions: number;
}

export function entryNutrients(content: Content, e: Pick<FoodEntry, 'foodId' | 'unit' | 'portions' | 'snapshot'>): Nutrients | null {
  if (e.snapshot) return { kcal: e.snapshot.kcal, proteinG: e.snapshot.proteinG, carbsG: 0, fatG: 0 };
  const food = content.food(e.foodId);
  if (!food) return null;
  try {
    return content.nutrients(food, e.unit as FoodUnitName, e.portions);
  } catch {
    return null;
  }
}

export function totals(content: Content, entries: FoodEntry[]): Totals {
  const t: Totals = { kcal: 0, proteinG: 0, portions: 0 };
  for (const e of entries) {
    const n = entryNutrients(content, e);
    if (!n) continue;
    t.kcal += n.kcal;
    t.proteinG += n.proteinG;
    t.portions += e.portions;
  }
  return { kcal: Math.round(t.kcal), proteinG: Math.round(t.proteinG), portions: Math.round(t.portions * 10) / 10 };
}

export const STATUS_WORD: Record<ProteinStatus, string> = {
  building: 'Building up',
  on_track: 'On track',
  met: 'Protein target met',
};

export function proteinCopy(eatenG: number, targetG: number): string {
  const left = Math.max(0, Math.round(targetG - eatenG));
  return left > 0 ? `${left} g of protein to go today` : 'You have reached your protein for today';
}

export function portionSteps(food: FoodItem, unit: FoodUnitName): { steps: number[]; default: number } {
  const u = food.units.find((x) => x.unit === unit) ?? food.units[0]!;
  return { steps: u.steps, default: u.default };
}

export const fractionLabel = (n: number): string => {
  const whole = Math.floor(n);
  const frac = n - whole;
  const f = Math.abs(frac - 0.5) < 0.01 ? '1/2' : Math.abs(frac - 0.25) < 0.01 ? '1/4' : Math.abs(frac - 0.75) < 0.01 ? '3/4' : '';
  if (!f) return String(n);
  return whole === 0 ? f : `${whole} ${f}`;
};

export function snapshotFor(content: Content, food: FoodItem, unit: FoodUnitName, portions: number): FoodEntry['snapshot'] {
  const n = content.nutrients(food, unit, portions);
  return { kcal: Math.round(n.kcal), proteinG: Math.round(n.proteinG * 10) / 10, packVersion: food.packVersion };
}

export function entryLine(content: Content, e: Pick<FoodEntry, 'foodId' | 'unit' | 'portions'>): string {
  const food = content.food(e.foodId);
  if (!food) return 'Food';
  let qty: string;
  try {
    qty = content.unitLabel(food, e.unit as FoodUnitName, e.portions);
  } catch {
    qty = String(e.portions);
  }
  return `${content.t(food.nameKey)} - ${qty}`;
}

// ---- Targets ----

export function targetsFor(
  profile: Pick<Profile, 'birthYear' | 'sex' | 'heightCm' | 'weightKg'> | null,
  goal: NutritionProfile['goal'],
  daysPerWeek: number,
  nowYear: number,
): NutritionResult {
  if (!profile || profile.birthYear == null) return { status: 'declined', reason: 'invalid_input' };
  return computeNutritionTargets({
    sex: profile.sex === 'woman' || profile.sex === 'man' ? profile.sex : 'other',
    age: nowYear - profile.birthYear,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    workoutsPerWeek: daysPerWeek,
    goal,
  });
}

export const DECLINE_COPY: Record<string, string> = {
  under_18: 'CasaFit does not set food targets for under 18s. A parent or a doctor can help with this.',
  low_bmi: 'For these details we suggest keeping your weight steady. A doctor or dietitian can guide you further.',
  too_rapid: 'That pace is faster than we suggest. Pick a steadier goal.',
  very_low_target: 'We cannot set a safe target from these details. A doctor or dietitian can help.',
  invalid_input: 'Check your age, height and weight in your profile, then try again.',
};

// ---- Meal plan ----

export interface PlanItem {
  foodId: string;
  unit: FoodUnitName;
  portions: number;
}
export interface PlanSlot {
  slot: Meal;
  items: PlanItem[];
}
export type PlanDays = PlanSlot[][];

export const profileHash = (p: Pick<NutritionProfile, 'diet' | 'allergies' | 'goal' | 'mealsPerDay' | 'targetKcal'>) =>
  [p.diet, [...p.allergies].sort().join('+'), p.goal, p.mealsPerDay, p.targetKcal].join('|');

export function slotsFor(meals: number): Meal[] {
  return meals <= 3 ? ['breakfast', 'lunch', 'dinner'] : meals === 4 ? ['breakfast', 'lunch', 'snack', 'dinner'] : ['breakfast', 'lunch', 'snack', 'dinner', 'snack'];
}

export function candidates(content: Content, p: Pick<NutritionProfile, 'diet' | 'allergies'>): FoodItem[] {
  const excl = p.allergies.filter((a) => a === 'peanut' || a === 'dairy' || a === 'gluten' || a === 'other') as ('peanut' | 'dairy' | 'gluten' | 'other')[];
  return content
    .searchFoods('', { kind: 'home', diet: p.diet, excludeAllergens: excl })
    .filter((f) => f.perDefaultUnit.kcal >= 40 && f.perDefaultUnit.kcal <= 400);
}

const half = (n: number) => Math.min(3, Math.max(0.5, Math.round(n * 2) / 2));

function itemFor(content: Content, food: FoodItem, kcalTarget: number): PlanItem {
  const u = food.units[0]!;
  const per = Math.max(1, content.nutrients(food, u.unit, 1).kcal);
  return { foodId: food.id, unit: u.unit, portions: half(kcalTarget / per) };
}

/** One week of sample days. Deterministic: the same profile always gives the same plan. */
export function buildMealPlan(content: Content, p: NutritionProfile): PlanDays {
  const pool = candidates(content, p);
  const slots = slotsFor(p.mealsPerDay);
  const shares = splitMeals(p.targetKcal, slots.length);
  return Array.from({ length: 7 }, (_, day) =>
    slots.map((slot, si) => {
      if (pool.length === 0) return { slot, items: [] };
      const a = pool[(day * 7 + si * 13) % pool.length]!;
      const b = pool[(day * 7 + si * 13 + 5) % pool.length]!;
      const share = shares[si] ?? 0;
      const items = a.id === b.id ? [itemFor(content, a, share)] : [itemFor(content, a, share / 2), itemFor(content, b, share / 2)];
      return { slot, items };
    }),
  );
}

/** Replacement items for a swap: the next candidate food not already in the slot. */
export function swapItems(content: Content, p: NutritionProfile, slot: PlanSlot, kcalTarget: number): PlanItem[] {
  const pool = candidates(content, p);
  const used = new Set(slot.items.map((i) => i.foodId));
  const first = slot.items[0] ? pool.findIndex((f) => f.id === slot.items[0]!.foodId) : -1;
  const next = pool.find((f, i) => i > first && !used.has(f.id)) ?? pool.find((f) => !used.has(f.id));
  return next ? [itemFor(content, next, kcalTarget)] : slot.items;
}

export function slotTotals(content: Content, s: PlanSlot): { kcal: number; proteinG: number } {
  let kcal = 0;
  let proteinG = 0;
  for (const i of s.items) {
    const f = content.food(i.foodId);
    if (!f) continue;
    const n = content.nutrients(f, i.unit, i.portions);
    kcal += n.kcal;
    proteinG += n.proteinG;
  }
  return { kcal: Math.round(kcal), proteinG: Math.round(proteinG) };
}
