import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ButtonPair, DestructiveButton, FilledButton, IconButton, OutlinedButton, TextButton, TonalButton } from './buttons';
import { OtpField, SearchField, SelectField, SliderField, TextField } from './fields';
import { PeopleIllustration } from './illustration';
import { BottomNav, TopBar, type TabKey } from './nav';
import { ConfirmDialog, BottomSheet } from './overlays';
import { Heatmap, ProgressBar, ProgressRing, SessionSegmentBar, WeekBars, WeekDots, WeekStrip } from './progress';
import { ChipGroup, CheckboxRow, ChoiceCard, RadioList, SegmentedControl, Stepper, Tabs, ToggleRow } from './selection';
import { Text } from './primitives';
import { Accordion, Badge, BenefitRow, ChecklistItem, CreditBadge, EmptyState, InfoNote, ListRow, PaywallPlanCard, SectionHeader, StatTile, StatusBanner, VerdictChip } from './surfaces';
import { space } from './tokens';
import { UIProvider, useTokens } from './useTokens';
import type { Scheme } from './tokens';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.m, marginBottom: space.xxl }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function GalleryBody({ onToggleScheme }: { onToggleScheme: () => void }) {
  const t = useTokens();
  const [tab, setTab] = useState<TabKey>('workout');
  const [chips, setChips] = useState<string[]>(['knees']);
  const [seg, setSeg] = useState('a');
  const [on, setOn] = useState(true);
  const [txt, setTxt] = useState('');
  const [otp, setOtp] = useState('12');
  const [slider, setSlider] = useState(4);
  const [n, setN] = useState(2);
  const [plan, setPlan] = useState('yearly');
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [open, setOpen] = useState(false);
  const [radio, setRadio] = useState('en');
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar title="UI gallery" leading="none" trailing={[{ icon: 'contrast', label: 'Toggle dark mode', onPress: onToggleScheme }]} />
      <ScrollView contentContainerStyle={{ padding: space.l }}>
        <Section title="Buttons">
          <ButtonPair>
            <FilledButton label="Start today" leadingIcon="play_arrow" />
            <TonalButton label="Change mix" />
            <OutlinedButton label="Continue with Google" />
            <TextButton label="Not now" />
            <DestructiveButton label="Delete everything" />
            <FilledButton label="Loading" loading />
          </ButtonPair>
          <IconButton icon="settings" label="Settings" tone="tonal" />
        </Section>
        <Section title="Chips and selection">
          <ChipGroup
            multi
            exclusive="none"
            options={[{ value: 'none', label: 'None' }, { value: 'knees', label: 'Knees' }, { value: 'back', label: 'Back' }]}
            selected={chips}
            onChange={setChips}
          />
          <SegmentedControl options={[{ value: 'a', label: 'Woman' }, { value: 'b', label: 'Man' }, { value: 'c', label: 'Other' }]} value={seg} onChange={setSeg} />
          <Tabs items={[{ value: 'a', label: 'Myths' }, { value: 'b', label: 'Concepts' }]} selected={seg === 'a' ? 'a' : 'b'} onSelect={setSeg} />
          <ChoiceCard icon="self_improvement" label="Stay fit" selected={on} onPress={() => setOn(!on)} />
          <CheckboxRow checked={on} onChange={setOn} label="I am 18 or older" variant="card" />
          <ToggleRow icon="notifications" title="Sunday recap" subtitle="A short summary each week" value={on} onChange={setOn} />
          <RadioList options={[{ id: 'en', label: 'English', native: 'English' }, { id: 'hi', label: 'Hindi', native: 'हिन्दी' }]} value={radio} onChange={setRadio} />
          <Stepper label="Normal days" value={n} min={0} max={5} onChange={setN} />
        </Section>
        <Section title="Fields">
          <TextField label="Height" value={txt} onChange={setTxt} keyboardType="numeric" suffix="cm" optional />
          <SelectField label="Year of birth" valueLabel="1990" onPress={() => undefined} />
          <SearchField value={txt} onChange={setTxt} trailing="mic" />
          <OtpField value={otp} onChange={setOtp} autoRead />
          <SliderField label="Days a week" min={3} max={7} value={slider} onChange={setSlider} />
        </Section>
        <Section title="Progress">
          <ProgressBar value={60} label="Plan progress" />
          <ProgressBar label="Reading code" />
          <View style={{ alignItems: 'center' }}>
            <ProgressRing value={4200} max={6000} a11yLabel="4,200 of 6,000 steps" center={<Text variant="headline" tabular>4,200</Text>} />
          </View>
          <SessionSegmentBar />
          <WeekBars values={[10, 30, 20, 40, 25, 0, 15]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} goal={30} highlightIndex={3} />
          <WeekDots days={['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => ({ label: l, done: i < 3 }))} />
          <Heatmap cells={Array.from({ length: 28 }, (_, i) => i % 4)} summary="Active on 21 of the last 28 days" />
          <WeekStrip days={[{ day: 'Mon', kind: 'today', icon: 'play_arrow' }, { day: 'Tue', kind: 'planned', icon: 'self_improvement' }, { day: 'Wed', kind: 'rest' }]} />
        </Section>
        <Section title="Surfaces">
          <StatTile value={12} suffix="/ 20" label="Brisk minutes" tone="tc" />
          <ListRow icon="settings" title="Settings" subtitle="Reminders and privacy" />
          <InfoNote text="Camera analysis stays on your phone." icon="lock" />
          <StatusBanner variant="medical">Talk to your doctor before you start.</StatusBanner>
          <ChecklistItem state="active" label="Building your plan" />
          <Badge label="Your plan is ready" />
          <VerdictChip verdict="partly" topic="Spot reduction" />
          <CreditBadge remaining={2} variant="tiles" />
          <BenefitRow icon="verified" title="Unlimited form checks" />
          <PaywallPlanCard title="Yearly" price="Rs 999" caption="Best value" badge="Save 40%" selected={plan === 'yearly'} onSelect={() => setPlan('yearly')} />
          <Accordion question="How is my plan built?" answer="From your goals, days and any pain areas you share." expanded={open} onToggle={() => setOpen(!open)} />
          <EmptyState icon="flag" title="Nothing here yet" body="Finish a session and your progress shows up here." />
        </Section>
        <Section title="Illustration (two-frame loop)">
          <View style={{ alignItems: 'center' }}>
            <PeopleIllustration pose="squat" a11yLabel="A person doing a squat" />
          </View>
        </Section>
        <Section title="Overlays">
          <TonalButton label="Open sheet" onPress={() => setSheet(true)} />
          <TonalButton label="Open dialog" onPress={() => setDialog(true)} />
        </Section>
      </ScrollView>
      <BottomNav current={tab} onSelect={setTab} />
      <BottomSheet visible={sheet} title="Sound" onDismiss={() => setSheet(false)}>
        <ToggleRow title="Quiet mode" value={on} onChange={setOn} />
      </BottomSheet>
      <ConfirmDialog
        visible={dialog}
        icon="delete_forever"
        title="Delete your account?"
        body="This removes your data from this phone and our servers."
        onDismiss={() => setDialog(false)}
        actions={[{ label: 'Keep my account', onPress: () => setDialog(false) }, { label: 'Delete everything', variant: 'destructive', onPress: () => setDialog(false) }]}
      />
    </View>
  );
}

/** Dev-only component gallery. Not wired to a route; mount it from a dev entry or a test. */
export function UIGallery({ initialScheme = 'light' }: { initialScheme?: Scheme }) {
  const [scheme, setScheme] = useState<Scheme>(initialScheme);
  return (
    <UIProvider scheme={scheme}>
      <GalleryBody onToggleScheme={() => setScheme((s) => (s === 'light' ? 'dark' : 'light'))} />
    </UIProvider>
  );
}
