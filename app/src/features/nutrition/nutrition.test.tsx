import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadContent } from '../../content';
import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import type { NutritionProfile, Repositories } from '../../db/repositories';
import { defaultPreferences, usePreferences } from '../../state/preferences';
import { setRepositories } from '../../state/storage';
import { configureNutritionDeps, todayKey, yesterdayKey } from './deps';
import { logFood } from './hooks';
import {
  SLOTS,
  buildMealPlan,
  fractionLabel,
  portionSteps,
  profileHash,
  slotForHour,
  slotTotals,
  targetsFor,
  totals,
} from './logic';
import { nutritionRoutes } from './index';
import { FoodEmptyScreen } from './screens/FoodEmptyScreen';
import { FoodSearchScreen } from './screens/FoodSearchScreen';
import { MealScreen } from './screens/MealScreen';
import { NutriPlanScreen } from './screens/NutriPlanScreen';
import { NutriProfileScreen } from './screens/NutriProfileScreen';
import { NutritionScreen } from './screens/NutritionScreen';

const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

const content = loadContent();
const dal = content.searchFoods('dal', { kind: 'home', diet: 'veg' })[0]!;

const profile = (over: Partial<NutritionProfile> = {}): NutritionProfile => ({
  diet: 'veg',
  allergies: [],
  allergyOther: null,
  goal: 'maintain',
  mealsPerDay: 4,
  targetKcal: 1800,
  targetProteinG: 70,
  computedAt: 1,
  inputsHash: 'x',
  ...over,
});

let repos: Repositories;
let close: () => void;

beforeEach(async () => {
  const db = await createTestDb();
  repos = db.repos;
  close = () => db.driver.close();
  setRepositories(repos);
  usePreferences.setState({ ...defaultPreferences(), hydrated: true });
  configureNutritionDeps({ now: () => new Date(2026, 9, 26, 13, 5), newId: (() => { let n = 0; return () => `id${(n += 1)}`; })() });
  Object.values(mockNav).forEach((f) => f.mockClear());
});
afterEach(() => {
  configureNutritionDeps(null);
  setRepositories(null);
  close();
});

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      {ui}
    </SafeAreaProvider>,
  );

const hasKcal = () => screen.queryAllByText(/kcal/i).length > 0;

describe('logic', () => {
  it('maps hours to meal slots and portions to fractions', () => {
    expect([8, 13, 16, 20].map(slotForHour)).toEqual(SLOTS);
    expect(['0.5', '1', '1.5', '2'].map((s) => fractionLabel(Number(s)))).toEqual(['1/2', '1', '1 1/2', '2']);
  });

  it('uses the catalogue portion steps (katori 1/2, 1, 1 1/2, 2)', () => {
    const p = portionSteps(dal, 'katori');
    expect(p.steps).toEqual([0.5, 1, 1.5, 2]);
    expect(p.default).toBe(1);
  });

  it('prefers the snapshot over the catalogue for old entries', () => {
    const t = totals(content, [
      { id: 'a', loggedOn: 'd', meal: 'lunch', foodId: dal.id, unit: 'katori', portions: 1, snapshot: { kcal: 100, proteinG: 5, packVersion: 1 }, createdAt: 1, syncedAt: null },
    ]);
    expect(t).toMatchObject({ kcal: 100, proteinG: 5, portions: 1 });
  });

  it('never targets under the calorie floor and declines under 18s', () => {
    const small = { birthYear: 1990, sex: 'woman' as const, heightCm: 150, weightKg: 45 };
    const r = targetsFor(small, 'lose_gently', 2, 2026);
    if (r.status === 'ok') expect(r.kcal).toBeGreaterThanOrEqual(1200);
    expect(targetsFor({ ...small, birthYear: 2012 }, 'maintain', 2, 2026)).toEqual({ status: 'declined', reason: 'under_18' });
    expect(targetsFor({ ...small, heightCm: null }, 'maintain', 2, 2026).status).toBe('needs_measures');
  });

  it('builds a vegetarian, allergen-safe week close to the target', () => {
    const p = profile({ allergies: ['peanut', 'dairy'] });
    const week = buildMealPlan(content, p);
    expect(week).toHaveLength(7);
    for (const day of week) {
      expect(day).toHaveLength(4);
      for (const s of day) {
        for (const i of s.items) {
          const f = content.food(i.foodId)!;
          expect(f.diet).toContain('veg');
          expect(f.allergens).not.toContain('peanut');
          expect(f.allergens).not.toContain('dairy');
        }
      }
      const kcal = day.reduce((a, s) => a + slotTotals(content, s).kcal, 0);
      expect(kcal).toBeGreaterThan(900);
      expect(kcal).toBeLessThan(2700);
    }
  });
});

describe('NutritionScreen', () => {
  it('asks the profile questions on first open', async () => {
    await wrap(<NutritionScreen />);
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('NutriProfile'));
  });

  it('shows the empty state, then copies yesterday', async () => {
    await repos.nutrition.saveProfile(profile());
    await logFood(dal.id, 'katori', 1, 'lunch', yesterdayKey());
    await wrap(<NutritionScreen />);
    await screen.findByText('Nothing logged yet today');
    await fireEvent.press(screen.getByLabelText('Same as yesterday'));
    await waitFor(async () => expect(await repos.food.forDay(todayKey())).toHaveLength(1));
    await screen.findByText(/g of protein to go today|reached your protein/);
  });

  it('shows protein and calories, removes an entry, and links to search', async () => {
    await repos.nutrition.saveProfile(profile());
    await logFood(dal.id, 'katori', 1, 'lunch');
    await wrap(<NutritionScreen />);
    await screen.findByText('Nutrition');
    expect(hasKcal()).toBe(true);
    await fireEvent.press(screen.getByLabelText('Add dinner'));
    expect(mockNav.navigate).toHaveBeenCalledWith('FoodSearch', { slot: 'dinner' });
    await fireEvent.press(screen.getByLabelText(/^Remove /));
    await waitFor(async () => expect(await repos.food.forDay(todayKey())).toHaveLength(0));
  });

  it('logs a saved meal from the sheet', async () => {
    await repos.nutrition.saveProfile(profile());
    await logFood(dal.id, 'katori', 1, 'lunch');
    await repos.nutrition.saveMeal({ id: 'm1', name: 'My lunch', items: [{ foodId: dal.id, unit: 'katori', portions: 2 }] });
    await wrap(<NutritionScreen />);
    await fireEvent.press(await screen.findByLabelText('Saved meals'));
    await fireEvent.press(await screen.findByText('My lunch'));
    await waitFor(async () => expect(await repos.food.forDay(todayKey())).toHaveLength(2));
  });
});

describe('calorie hiding guard (D7)', () => {
  const seed = async () => {
    await repos.nutrition.saveProfile(profile());
    await logFood(dal.id, 'katori', 1, 'lunch');
  };

  it('Nutrition: switching off removes every kcal and uses neutral words', async () => {
    await seed();
    await wrap(<NutritionScreen />);
    await screen.findByText('Nutrition');
    expect(hasKcal()).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show calories'));
    await waitFor(() => expect(hasKcal()).toBe(false));
    expect(usePreferences.getState().showCalories).toBe(false);
    expect(screen.getByText(/Building up|On track|Protein target met/)).toBeTruthy();
    expect(screen.queryByText(/over|too much|failed/i)).toBeNull();
  });

  it.each([
    ['NutriPlan', () => <NutriPlanScreen />],
    ['FoodSearch', () => <FoodSearchScreen />],
    ['Meal', () => <MealScreen route={{ params: { mealId: dal.id, slot: 'lunch' } } as never} />],
  ])('%s: no kcal when hidden, kcal when shown', async (_n, el) => {
    await seed();
    await usePreferences.getState().setShowCalories(true);
    const view = await wrap(el());
    await waitFor(() => expect(hasKcal()).toBe(true));
    await view.unmount();
    await usePreferences.getState().setShowCalories(false);
    await wrap(el());
    expect((await screen.findAllByText(/g protein/)).length).toBeGreaterThan(0);
    expect(hasKcal()).toBe(false);
  });
});

describe('FoodSearch', () => {
  it('searches offline, switches tabs and opens the meal with the slot', async () => {
    await wrap(<FoodSearchScreen route={{ params: { slot: 'dinner' } } as never} />);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'dal');
    const name = content.t(dal.nameKey);
    await fireEvent.press((await screen.findAllByLabelText(new RegExp(`^${name}`)))[0]!);
    expect(mockNav.navigate).toHaveBeenCalledWith('Meal', expect.objectContaining({ slot: 'dinner' }));
    await fireEvent.press(screen.getByLabelText('Restaurant'));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'zzzzqq');
    await screen.findByText(/Nothing matches/);
  });

  it('leaves out foods that clash with the saved allergies', async () => {
    await repos.nutrition.saveProfile(profile({ allergies: ['peanut'] }));
    await wrap(<FoodSearchScreen />);
    const peanut = content.foods.find((f) => f.kind === 'home' && f.allergens.includes('peanut') && f.diet.includes('veg'));
    await waitFor(() => expect(screen.queryAllByText(/g protein/).length).toBeGreaterThan(0));
    if (peanut) expect(screen.queryByLabelText(new RegExp(`^${content.t(peanut.nameKey)},`))).toBeNull();
  });
});

describe('MealScreen', () => {
  it('picks a katori portion and logs it with a snapshot', async () => {
    await wrap(<MealScreen route={{ params: { mealId: dal.id, slot: 'lunch' } } as never} />);
    expect(screen.getAllByText('Add to lunch').length).toBe(2);
    await fireEvent.press(screen.getByLabelText('1 1/2 katori'));
    await fireEvent.press(screen.getByLabelText('Add to lunch'));
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Main', { screen: 'Nutrition' }));
    const [e] = await repos.food.forDay(todayKey());
    expect(e).toMatchObject({ foodId: dal.id, unit: 'katori', portions: 1.5, meal: 'lunch' });
    expect(e!.snapshot?.kcal).toBeGreaterThan(0);
  });

  it('offers chamach when the food has it and resets the portion', async () => {
    const f = content.foods.find((x) => x.units.some((u) => u.unit === 'chamach') && x.units[0]!.unit === 'katori')!;
    await wrap(<MealScreen route={{ params: { mealId: f.id } } as never} />);
    await fireEvent.press(screen.getByLabelText('Chamach'));
    expect(screen.getByText(/serving spoon/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add to lunch'));
    await waitFor(async () => expect((await repos.food.forDay(todayKey()))[0]?.unit).toBe('chamach'));
  });

  it('asks for a food when none is chosen', async () => {
    await wrap(<MealScreen />);
    await fireEvent.press(screen.getByLabelText('Find a food'));
    expect(mockNav.navigate).toHaveBeenCalledWith('FoodSearch', { slot: 'lunch' });
  });
});

describe('NutriProfileScreen', () => {
  const seedMe = (over = {}) => repos.profile.save({ birthYear: 1990, sex: 'woman', heightCm: 160, weightKg: 60, ...over });

  it('keeps the button off until a goal is chosen, then saves targets and goes to the plan', async () => {
    await seedMe();
    await repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1' });
    await wrap(<NutriProfileScreen />);
    const cta = await screen.findByLabelText('Build my food plan');
    expect(cta.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Keep steady'));
    await fireEvent.press(screen.getByLabelText('Peanuts'));
    await fireEvent.press(screen.getByLabelText('Build my food plan'));
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('NutriPlan'));
    const p = await repos.nutrition.getProfile();
    expect(p).toMatchObject({ diet: 'veg', goal: 'maintain', mealsPerDay: 4, allergies: ['peanut'] });
    expect(p!.targetKcal).toBeGreaterThanOrEqual(1200);
  });

  it('allergy None clears the others', async () => {
    await seedMe();
    await wrap(<NutriProfileScreen />);
    await fireEvent.press(await screen.findByLabelText('Peanuts'));
    await fireEvent.press(screen.getByLabelText('Dairy'));
    await fireEvent.press(screen.getByLabelText('None'));
    expect(screen.getByLabelText('None').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Peanuts').props.accessibilityState.checked).toBe(false);
  });

  it('declines gently for an under 18 profile and saves nothing', async () => {
    await seedMe({ birthYear: 2014 });
    await wrap(<NutriProfileScreen />);
    await fireEvent.press(await screen.findByLabelText('Keep steady'));
    await fireEvent.press(screen.getByLabelText('Build my food plan'));
    await screen.findByText(/under 18/);
    expect(await repos.nutrition.getProfile()).toBeNull();
  });

  it('asks for height and weight when they are missing', async () => {
    await seedMe({ heightCm: null, weightKg: null });
    await wrap(<NutriProfileScreen />);
    await fireEvent.press(await screen.findByLabelText('Keep steady'));
    await fireEvent.press(screen.getByLabelText('Build my food plan'));
    await screen.findByText(/Add your height and weight/);
  });

  it('is pre-filled in edit mode with a Save button', async () => {
    await repos.nutrition.saveProfile(profile({ goal: 'gain', mealsPerDay: 5 }));
    await wrap(<NutriProfileScreen />);
    expect(await screen.findByLabelText('Save')).toBeTruthy();
    expect(screen.getByLabelText('Build up').props.accessibilityState.selected).toBe(true);
  });
});

describe('NutriPlanScreen', () => {
  it('shows the target, swaps a meal and saves the plan as active', async () => {
    const p = profile();
    await repos.nutrition.saveProfile(p);
    await wrap(<NutriPlanScreen />);
    await screen.findByText('Every day, for steady weight');
    expect(screen.getByText('70 g protein')).toBeTruthy();
    const before = screen.getAllByText(/ - /).map((n) => n.props.children).join();
    await fireEvent.press(screen.getByLabelText('Swap breakfast'));
    expect(screen.getAllByText(/ - /).map((n) => n.props.children).join()).not.toBe(before);
    await fireEvent.press(screen.getByLabelText('Tue'));
    await fireEvent.press(screen.getByLabelText('Use this plan'));
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Main', { screen: 'Nutrition' }));
    const plan = await repos.nutrition.activeMealPlan();
    expect(plan?.profileHash).toBe(profileHash(p));
  });

  it('points to the profile when there is none', async () => {
    await wrap(<NutriPlanScreen />);
    await fireEvent.press(await screen.findByLabelText('Set up your food plan'));
    expect(mockNav.navigate).toHaveBeenCalledWith('NutriProfile');
  });
});

describe('FoodEmptyScreen', () => {
  it('offers the time-aware log button, a plan suggestion and copy from yesterday', async () => {
    await repos.nutrition.saveProfile(profile());
    await repos.nutrition.saveMealPlan({ id: 'p', profileHash: profileHash(profile()), days: buildMealPlan(content, profile()), createdAt: 1 });
    await logFood(dal.id, 'katori', 1, 'lunch', yesterdayKey());
    await wrap(<FoodEmptyScreen />);
    await fireEvent.press(await screen.findByLabelText('Log lunch'));
    expect(mockNav.navigate).toHaveBeenCalledWith('FoodSearch', { slot: 'lunch' });
    expect(screen.getByText(/Today's suggestion/)).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Same as yesterday'));
    });
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Main', { screen: 'Nutrition' }));
    expect(await repos.food.forDay(todayKey())).toHaveLength(1);
  });

  it('disables copy for new users and links to profile setup', async () => {
    await wrap(<FoodEmptyScreen />);
    expect((await screen.findByLabelText('Same as yesterday')).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Set up your food plan'));
    expect(mockNav.navigate).toHaveBeenCalledWith('NutriProfile');
  });
});

describe('route registry', () => {
  it('exports a component for each nutrition route', () => {
    expect(Object.keys(nutritionRoutes).sort()).toEqual(['FoodEmpty', 'FoodSearch', 'Meal', 'NutriPlan', 'NutriProfile']);
    for (const e of Object.values(nutritionRoutes)) expect(typeof e.component).toBe('function');
  });
});
