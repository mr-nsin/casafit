// Learn hub (m3-learn, m3-concepts, m3-learnform), myth detail (m3-myth) and concept detail
// (m3-concept). All content is bundled and works offline. Every card shows its review status
// as it really is.

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { loadContent, type Concept, type Content, type Myth } from '../../content';
import {
  Badge,
  BottomNav,
  Card,
  EmptyState,
  FilledButton,
  Icon,
  ListRow,
  SectionLabel,
  Tabs,
  Text,
  TextButton,
  TopBar,
  Touchable,
  VerdictChip,
  radius,
  space,
  useTokens,
  type TabKey,
} from '../../ui';
import { chipVerdict, ctaTarget, MYTH_TONES, nextOf, reviewInfo, sortedConcepts, sortedMyths, type ReviewInfo } from './model';
import { Page } from './Page';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type HubTab = 'myths' | 'concepts' | 'form';

const TAB_TARGET = { workout: 'Workout', nutrition: 'Nutrition', progress: 'Progress' } as const;
const TONE_TEXT = { pc: 'opc', tc: 'otc', sc: 'osc' } as const;

let contentOverride: Content | null = null;
/** Tests can inject a content object. The app uses the bundled packs. */
export const configureLearnContent = (c: Content | null) => {
  contentOverride = c;
};
const useLearnContent = (): Content => useMemo(() => contentOverride ?? loadContent(), []);

function ReviewNote({ info }: { info: ReviewInfo }) {
  return (
    <View style={{ gap: space.xs }} testID="review-note">
      {info.sources.map((s) => (
        <Text key={s} variant="bodySmall" color="osv">
          {s}
        </Text>
      ))}
      <Text variant="bodySmall" color="osv">
        {info.line}
      </Text>
    </View>
  );
}

function Hub({ initial }: { initial: HubTab }) {
  const nav = useNavigation<Nav>();
  const content = useLearnContent();
  const [tab, setTab] = useState<HubTab>(initial);
  const myths = sortedMyths(content.myths);
  const concepts = sortedConcepts(content.concepts);
  const formTips = content.exercises
    .filter((e) => e.formCheckable)
    .map((e) => ({ id: e.id, name: content.t(e.nameKey), cue: content.formCues(e.id)[0]?.text }))
    .filter((e): e is { id: string; name: string; cue: string } => !!e.cue);

  return (
    <View style={{ flex: 1 }}>
      <Page top={<TopBar title="Learn" onLeading={() => nav.goBack()} />}>
        <Text color="osv">Short facts to help you train with less confusion.</Text>
        <Tabs
          items={[
            { value: 'myths', label: 'Myths' },
            { value: 'concepts', label: 'Concepts' },
            { value: 'form', label: 'Form tips' },
          ]}
          selected={tab}
          onSelect={setTab}
        />
        {tab === 'myths' ? myths.map((m, i) => <MythCard key={m.id} myth={m} tone={MYTH_TONES[i % 3]!} content={content} />) : null}
        {tab === 'concepts' ? (
          <>
            <Text color="osv">Short reads, 60 to 90 seconds each. They work offline.</Text>
            {concepts.map((c) => (
              <ListRow
                key={c.id}
                icon={c.icon}
                title={content.t(c.titleKey)}
                subtitle={`${c.readMinutes} min read${c.startHere ? ' . start here' : ''}`}
                onPress={() => nav.navigate('Concepts', { conceptId: c.id })}
              />
            ))}
          </>
        ) : null}
        {tab === 'form' ? (
          <>
            <Text color="osv">One cue per move. Read it before you start, then trust your body.</Text>
            {formTips.length === 0 ? <EmptyState icon="accessibility_new" title="No form tips yet" body="They will appear here." /> : null}
            {formTips.map((f) => (
              <Card key={f.id} tone="c3">
                <View style={{ gap: space.xs }} accessible accessibilityLabel={`${f.name}. ${f.cue}`}>
                  <Text variant="title">{f.name}</Text>
                  <Text>{f.cue}</Text>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </Page>
      <BottomNav current={null} onSelect={(k: TabKey) => nav.navigate('Main', { screen: TAB_TARGET[k] })} />
    </View>
  );
}

function MythCard({ myth, tone, content }: { myth: Myth; tone: (typeof MYTH_TONES)[number]; content: Content }) {
  const nav = useNavigation<Nav>();
  const t = useTokens();
  const fg = TONE_TEXT[tone];
  const info = reviewInfo(myth);
  const verdict = content.t(`learn.verdict.${myth.verdict}`);
  return (
    <Touchable
      label={`Myth: ${content.t(myth.titleKey)}. ${verdict}.`}
      onPress={() => nav.navigate('Myth', { mythId: myth.id })}
      style={{ backgroundColor: t[tone], borderRadius: radius.xl, padding: space.l, gap: space.s, minHeight: 64 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name={myth.verdict === 'true' ? 'check' : myth.verdict === 'false' ? 'close' : 'remove'} size={16} color={fg} />
        <Text variant="labelStrong" color={fg}>{`Myth . ${verdict}`}</Text>
      </View>
      <Text variant="title" color={fg}>
        {content.t(myth.titleKey)}
      </Text>
      <Text variant="labelStrong" color={fg}>
        What is true
      </Text>
      <Text color={fg} numberOfLines={3}>
        {content.t(myth.trueKey)}
      </Text>
      {info.reviewed ? null : <Badge label="Review pending" tone="c3" />}
    </Touchable>
  );
}

export function LearnScreen() {
  return <Hub initial="myths" />;
}

export function MythScreen({ route }: { route?: { params?: { mythId?: string } } }) {
  const nav = useNavigation<Nav>();
  const content = useLearnContent();
  const list = sortedMyths(content.myths);
  const myth = list.find((m) => m.id === route?.params?.mythId) ?? null;

  if (!myth) {
    return (
      <Page top={<TopBar title="Myth" onLeading={() => nav.goBack()} />}>
        <EmptyState icon="search_off" title="We could not find that myth" body="Head back to Learn to see them all." />
        <TextButton label="Back to Learn" onPress={() => nav.replace('Learn')} />
      </Page>
    );
  }
  const info = reviewInfo(myth);
  const next = nextOf(list, myth.id);
  const target = ctaTarget(myth.cta);
  return (
    <Page
      top={<TopBar title="Myth" onLeading={() => nav.goBack()} />}
      footer={
        next ? (
          <FilledButton label="Next myth" onPress={() => nav.replace('Myth', { mythId: next.id })} />
        ) : (
          <FilledButton label="Back to Learn" onPress={() => nav.replace('Learn')} />
        )
      }
    >
      <VerdictChip verdict={chipVerdict(myth.verdict)} />
      <Text variant="headline" accessibilityRole="header">
        {content.t(myth.titleKey)}
      </Text>
      <Card tone="pc">
        <View style={{ gap: space.xs }}>
          <Text variant="title" color="opc">
            What is true
          </Text>
          <Text color="opc">{content.t(myth.trueKey)}</Text>
        </View>
      </Card>
      <Card tone="c3">
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <Icon name="science" color="p" />
          <Text style={{ flex: 1 }}>
            <Text variant="title">What the research found. </Text>
            {content.t(myth.evidenceKey)}
          </Text>
        </View>
      </Card>
      <SectionLabel title="What to do in CasaFit" />
      <ListRow
        icon="accessibility_new"
        title={content.t(myth.cta.labelKey)}
        tone="c3"
        // The target comes from bundled content, so the name is checked by a test, not by the types.
        onPress={() => (nav.navigate as (name: string, params?: unknown) => void)(target.name, target.params)}
      />
      <ReviewNote info={info} />
    </Page>
  );
}

/** The Concepts route: the hub on its Concepts tab, or one concept when `conceptId` is set. */
export function ConceptsScreen({ route }: { route?: { params?: { conceptId?: string } } }) {
  const id = route?.params?.conceptId;
  return id ? <ConceptDetail conceptId={id} /> : <Hub initial="concepts" />;
}

function ConceptDetail({ conceptId }: { conceptId: string }) {
  const nav = useNavigation<Nav>();
  const content = useLearnContent();
  const list = sortedConcepts(content.concepts);
  const concept: Concept | undefined = list.find((c) => c.id === conceptId);
  if (!concept) {
    return (
      <Page top={<TopBar title="Concept" onLeading={() => nav.goBack()} />}>
        <EmptyState icon="search_off" title="We could not find that read" body="Head back to Concepts to see them all." />
        <TextButton label="Back to concepts" onPress={() => nav.replace('Concepts')} />
      </Page>
    );
  }
  const info = reviewInfo(concept);
  const next = nextOf(list, concept.id);
  return (
    <Page
      top={<TopBar title="Concept" onLeading={() => nav.goBack()} />}
      footer={
        <>
          {next ? <FilledButton label="Next concept" onPress={() => nav.replace('Concepts', { conceptId: next.id })} /> : null}
          <TextButton label="Back to concepts" onPress={() => nav.replace('Concepts')} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name="schedule" size={18} color="osv" />
        <Text variant="label" color="osv">{`${concept.readMinutes} min read . works offline`}</Text>
      </View>
      <Text variant="headline" accessibilityRole="header">
        {content.t(concept.titleKey)}
      </Text>
      {concept.bodyKeys.map((k) => (
        <Text key={k}>{content.t(k)}</Text>
      ))}
      <Card tone="tc">
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <Icon name="lightbulb" color="otc" />
          <Text color="otc" style={{ flex: 1 }}>
            <Text variant="title" color="otc">
              Key point.{' '}
            </Text>
            {content.t(concept.takeawayKey)}
          </Text>
        </View>
      </Card>
      <ReviewNote info={info} />
    </Page>
  );
}
