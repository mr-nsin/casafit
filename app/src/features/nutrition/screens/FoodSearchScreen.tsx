import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SearchField, SectionLabel, Tabs, Text, TopBar, space, useTokens } from '../../../ui';
import type { FoodKind } from '../../../content/types';
import { FoodRow } from '../components';
import { getNutritionDeps } from '../deps';
import { useNav } from '../hooks';
import { asSlot } from '../logic';
import type { RootScreenProps } from '../../../app/types';

const KINDS: { value: FoodKind; label: string }[] = [
  { value: 'home', label: 'Home-cooked' },
  { value: 'packaged', label: 'Packaged' },
  { value: 'restaurant', label: 'Restaurant' },
];

/** m3-foodsearch. Offline search over the bundled catalogue, filtered by the user's diet and allergies. */
export function FoodSearchScreen({ route }: Partial<RootScreenProps<'FoodSearch'>>) {
  const nav = useNav();
  const t = useTokens();
  const d = getNutritionDeps();
  const content = d.content();
  const slot = asSlot(route?.params?.slot, d.now().getHours());
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<FoodKind>('home');
  const [recent, setRecent] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ diet?: 'veg' | 'egg' | 'nonveg' | 'jain'; excl: ('peanut' | 'dairy' | 'gluten' | 'other')[] }>({ excl: [] });

  useEffect(() => {
    void (async () => {
      const r = d.repos();
      const [ids, p] = await Promise.all([r.food.recentFoodIds(5), r.nutrition.getProfile()]);
      setRecent(ids);
      if (p) setFilters({ diet: p.diet, excl: p.allergies.filter((a): a is 'peanut' | 'dairy' | 'gluten' | 'other' => a !== 'none') });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(
    () => content.searchFoods(q, { kind, diet: filters.diet, excludeAllergens: filters.excl, limit: 40 }),
    [content, q, kind, filters],
  );
  const recentFoods = recent.map((id) => content.food(id)).filter((f): f is NonNullable<typeof f> => !!f && f.kind === kind);
  const open = (id: string) => nav.navigate('Meal', { mealId: id, slot });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar title="Find a food" onLeading={() => nav.goBack()} />
      <View style={{ paddingHorizontal: space.l, gap: space.m }}>
        <SearchField value={q} onChange={setQ} placeholder="Search foods" label="Search foods" />
        <Tabs items={KINDS} selected={kind} onSelect={setKind} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: space.xxxl }}>
        {q === '' && recentFoods.length > 0 ? (
          <>
            <SectionLabel title="Recent" />
            {recentFoods.map((f) => (
              <FoodRow key={`r-${f.id}`} food={f} onPress={() => open(f.id)} />
            ))}
          </>
        ) : null}
        <SectionLabel title={q ? 'All results' : 'Foods'} />
        {results.length === 0 ? (
          <Text color="osv" accessibilityLiveRegion="polite">
            Nothing matches that yet. Try another word, or look in a different tab.
          </Text>
        ) : (
          results.map((f) => <FoodRow key={f.id} food={f} onPress={() => open(f.id)} />)
        )}
      </ScrollView>
    </View>
  );
}
