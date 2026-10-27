// Goals, About, Mix, Health.

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { OnboardingDraft } from '../../../db/repositories';
import type { BodyPart, HealthFlag, Style } from '../../../engine';
import { useConsent } from '../../../state/consent';
import { useOnboarding } from '../../../state/onboardingDraft';
import {
  Badge,
  Chip,
  ChipGroup,
  ChoiceCard,
  CheckboxRow,
  FilledButton,
  ProgressBar,
  SectionLabel,
  SegmentedControl,
  SliderField,
  Stepper,
  StatusBanner,
  StatusCard,
  Text,
  TextButton,
  TextField,
  space,
  radius,
  useTokens,
} from '../../../ui';
import { Layout, useBack, useOnboardingNav } from '../Layout';
import { getOnboardingDeps } from '../deps';
import {
  BODY_PART_OPTIONS,
  EXPERIENCE_OPTIONS,
  HEALTH_OPTIONS,
  MAX_BODY_PARTS,
  PAIN_OPTIONS,
  SEX_OPTIONS,
  STYLE_OPTIONS,
  canContinueGoals,
  defaultMix,
  healthIntro,
  mixTotal,
  nextAfterAbout,
  nextAfterMix,
  parseHeight,
  parseWeight,
} from '../logic';

export function GoalsScreen() {
  const nav = useOnboardingNav();
  const back = useBack();
  const { draft, update } = useOnboarding();
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Layout
      topBar={{ leading: nav.canGoBack() ? 'back' : 'none', onLeading: back, stepLabel: '1 of 2' }}
      footer={
        <FilledButton label="Next: about you" trailingIcon="arrow_forward" disabled={!canContinueGoals(draft)} onPress={() => nav.navigate('About')} />
      }
    >
      <ProgressBar value={50} label="Step 1 of 2" />
      <Text variant="headline">What do you want?</Text>
      <SectionLabel title="Your goal" />
      <ChoiceCard icon="accessibility_new" label="Stay fit, full body" selected={draft.goal === 'stay_fit'} onPress={() => void update({ goal: 'stay_fit' })} />
      <ChoiceCard icon="target" label="Train specific body parts" selected={draft.goal === 'body_part'} onPress={() => void update({ goal: 'body_part' })} />
      {draft.goal === 'body_part' ? (
        <>
          <SectionLabel title="Which body parts?" hint="Up to 2" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {BODY_PART_OPTIONS.map((o) => {
              const sel = draft.bodyParts.includes(o.value);
              return (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={sel}
                  disabled={!sel && draft.bodyParts.length >= MAX_BODY_PARTS}
                  onPress={() => void update({ bodyParts: toggle<BodyPart>(draft.bodyParts as BodyPart[], o.value) })}
                />
              );
            })}
          </View>
        </>
      ) : null}
      <SectionLabel title="What do you enjoy?" hint="One, two or all three" />
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {STYLE_OPTIONS.map((o) => (
          <View key={o.value} style={{ flex: 1 }}>
            <ChoiceCard
              icon={o.icon}
              label={o.label}
              size="tile"
              role="checkbox"
              selected={draft.styles.includes(o.value)}
              onPress={() => void update({ styles: toggle<Style>(draft.styles, o.value) })}
            />
          </View>
        ))}
      </View>
      <Text variant="bodySmall" color="osv">
        {draft.styles.length === 3
          ? 'All three picked: you choose the mix on a later step.'
          : 'Pick two and we split your week between them. Pick all three and you choose the mix.'}
      </Text>
    </Layout>
  );
}

export function AboutScreen() {
  const nav = useOnboardingNav();
  const back = useBack('Goals');
  const { draft, update } = useOnboarding();
  const [height, setHeight] = useState(draft.heightCm ? String(draft.heightCm) : '');
  const [weight, setWeight] = useState(draft.weightKg ? String(draft.weightKg) : '');
  const h = parseHeight(height);
  const w = parseWeight(weight);
  const next = nextAfterAbout(draft);
  const pain = draft.painAreas.length ? draft.painAreas : (['none'] as const);
  const flags = draft.healthFlags.length ? draft.healthFlags : (['none'] as const);

  return (
    <Layout
      topBar={{ leading: 'back', onLeading: back, stepLabel: '2 of 2' }}
      footer={
        <FilledButton
          label={next === 'Building' ? 'Build my plan' : 'Continue'}
          leadingIcon={next === 'Building' ? 'auto_awesome' : undefined}
          disabled={!!h.error || !!w.error}
          onPress={async () => {
            await update({ heightCm: h.value, weightKg: w.value });
            nav.navigate(next);
          }}
        />
      }
    >
      <ProgressBar value={100} label="Step 2 of 2" />
      <Text variant="headline">About you</Text>
      <TextField
        label="Height, cm"
        value={height}
        onChange={(v) => {
          setHeight(v);
          const p = parseHeight(v);
          if (!p.error) void update({ heightCm: p.value });
        }}
        keyboardType="number-pad"
        optional
        error={h.error}
        helper="Optional. Skip it if you like."
        testID="about-height"
      />
      <TextField
        label="Weight, kg"
        value={weight}
        onChange={(v) => {
          setWeight(v);
          const p = parseWeight(v);
          if (!p.error) void update({ weightKg: p.value });
        }}
        keyboardType="decimal-pad"
        optional
        error={w.error}
        helper="Optional. Skip it if you like."
        testID="about-weight"
      />
      <SectionLabel title="Sex" />
      <SegmentedControl label="Sex" options={SEX_OPTIONS} value={(draft.sex ?? '') as never} onChange={(v) => void update({ sex: v })} />
      <SectionLabel title="Training experience" />
      <SegmentedControl
        label="Training experience"
        options={EXPERIENCE_OPTIONS}
        value={(draft.experience ?? '') as never}
        onChange={(v) => void update({ experience: v })}
      />
      <SliderField label="Days a week" min={3} max={7} unit="days" value={draft.daysPerWeek} onChange={(v) => void update({ daysPerWeek: v as OnboardingDraft['daysPerWeek'] })} />
      <SectionLabel title="Any pain or past injury?" />
      <ChipGroup
        multi
        exclusive="none"
        label="Pain or past injury"
        options={PAIN_OPTIONS}
        selected={[...pain]}
        onChange={(v) => void update({ painAreas: v.filter((x) => x !== 'none') as never })}
      />
      {draft.painAreas.includes('knees') ? <Text variant="bodySmall" color="osv">We&apos;ll skip lunges and tell you why.</Text> : null}
      <SectionLabel title="Anything we should know?" />
      <ChipGroup
        multi
        exclusive="none"
        label="Health notes"
        options={HEALTH_OPTIONS}
        selected={[...flags]}
        onChange={(v) => void update({ healthFlags: v.filter((x) => x !== 'none') as HealthFlag[] })}
      />
      <Text variant="bodySmall" color="osv">Your health notes stay on this phone. You choose whether to share them on the next step.</Text>
    </Layout>
  );
}

export function MixScreen() {
  const nav = useOnboardingNav();
  const back = useBack('About');
  const { draft, update } = useOnboarding();
  const styles = draft.styles;
  const days = draft.daysPerWeek;
  useEffect(() => {
    // First visit, or the days or styles changed since: start from an even split.
    if (mixTotal(draft.mix, styles) !== days && Object.keys(draft.mix).length === 0) void update({ mix: defaultMix(styles, days) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const total = mixTotal(draft.mix, styles);
  const t = useTokens();
  const tones: Record<Style, string> = { normal: t.sc, dance: t.pc, yoga: t.tc };
  return (
    <Layout
      topBar={{ leading: 'back', onLeading: back, title: 'Choose your mix' }}
      footer={<FilledButton label="Use this mix" disabled={total !== days} onPress={() => nav.navigate(nextAfterMix(draft))} />}
    >
      <Text color="osv">You picked all three styles. Split the {days} days a week you chose on the last step however you like.</Text>
      <Badge label={`${total} of ${days} days assigned`}  />
      {STYLE_OPTIONS.map((o) => {
        const n = draft.mix[o.value] ?? 0;
        return (
          <View key={o.value} style={{ minHeight: 88, borderRadius: radius.xl, backgroundColor: tones[o.value], padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <View style={{ flex: 1 }}>
              <Text variant="title">{o.label}</Text>
              <Text variant="bodySmall" color="osv">{o.blurb}</Text>
            </View>
            <Stepper
              label={`${o.label} days`}
              value={n}
              min={0}
              max={Math.min(days, n + (days - total))}
              onChange={(v) => void update({ mix: { ...draft.mix, [o.value]: v } })}
            />
          </View>
        );
      })}
      <StatusBanner variant="info">We never put two hard days for the same muscles back to back. You can change the mix any time in My plan.</StatusBanner>
    </Layout>
  );
}

export function HealthScreen() {
  const nav = useOnboardingNav();
  const back = useBack('About');
  const { draft, update } = useOnboarding();
  const [agree, setAgree] = useState(draft.healthConsent?.granted ?? false); // unticked by default (D2)
  const [saving, setSaving] = useState(false);
  const go = async () => {
    setSaving(true);
    await useConsent.getState().record('health_answers', agree, 'onboarding');
    await update({ healthConsent: { granted: agree, at: new Date(getOnboardingDeps().now()).toISOString() } });
    setSaving(false);
    nav.navigate('Building');
  };
  return (
    <Layout
      topBar={{ leading: 'back', onLeading: back }}
      footer={<FilledButton label="Build my gentler plan" loading={saving} onPress={() => void go()} />}
    >
      <Text variant="headline">We picked a gentler plan</Text>
      <Text color="osv">{healthIntro(draft.healthFlags)}</Text>
      <StatusCard
        title="What changes in your plan"
        items={[
          'Lower effort and longer rests',
          'No HIIT and no jumping to start',
          'Reverse walking is switched off',
          'You can still change the pace any time',
        ]}
      />
      <StatusBanner variant="medical">
        Please check with your doctor before you start. CasaFit gives general guidance and cannot replace medical advice.
      </StatusBanner>
      <CheckboxRow
        variant="card"
        checked={agree}
        onChange={setAgree}
        label="I agree CasaFit uses my health answers only to keep my plan safe. I can delete them any time."
      />
      <Text variant="bodySmall" color="osv">Not ticked? You can still continue. Your answers stay on this phone and shape your plan there.</Text>
      <TextButton label="Read the privacy notice" onPress={() => getOnboardingDeps().openPrivacyNotice()} />
    </Layout>
  );
}
