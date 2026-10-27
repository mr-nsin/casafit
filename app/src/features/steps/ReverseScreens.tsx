// Reverse walk: safety check (m3-reverse) and the running bout (m3-reversetimer).
// Opt-in, 15 minutes a day at most, never offered with a health flag, age 60+ or a balance
// concern. Sensors cannot tell direction, so the declared bout is the only signal.

import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { formatMmSs, reverseBoutState, REVERSE_BOUT_TARGET_S, REVERSE_DAILY_CAP_S, type ReverseEligibility } from '../../engine';
import { getRepositories } from '../../state/storage';
import { deviceTzOffsetMin, todayKey } from '../../services/step-counter';
import {
  CheckboxRow,
  FilledButton,
  InfoNote,
  StatTile,
  Text,
  TimerRing,
  TopBar,
  WarningBanner,
  space,
  Card,
  Icon,
} from '../../ui';
import { formatCount, reverseEligibilityFor, usedSeconds } from './model';
import { Page } from './Page';
import { useBout } from './reverseStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

async function loadEligibility(): Promise<{ e: ReverseEligibility; usedS: number }> {
  const repos = getRepositories();
  const now = Date.now();
  const tz = deviceTzOffsetMin(now);
  const usedS = usedSeconds(await repos.steps.boutsSince(now - 2 * 86_400_000), todayKey(now, tz), now, tz, useBout.getState().id ?? undefined);
  const e = reverseEligibilityFor(await repos.profile.get(), usedS, new Date(now).getFullYear());
  return { e, usedS };
}

const CHECKS = [
  'The space is flat, clear and dry. No stairs, kerbs or pets.',
  'I can touch a wall or rail, or I am on a treadmill at a slow speed.',
  'I will stop at once if I feel dizzy or unsteady.',
];

const BLOCK_COPY: Record<'health_flag' | 'age' | 'balance' | 'daily_cap', { title: string; body: string }> = {
  health_flag: { title: 'Reverse walk is not for you right now', body: 'Based on what you told us about your health, we keep this option off. Normal and brisk walking count fully.' },
  age: { title: 'Reverse walk is not for you right now', body: 'We keep this option off for safety. Normal and brisk walking count fully.' },
  balance: { title: 'Reverse walk is not for you right now', body: 'We keep this option off when balance is a concern. Normal and brisk walking count fully.' },
  daily_cap: { title: "You've done today's reverse walk", body: 'That is the 15 minutes for today. You can try again tomorrow.' },
};

export function ReverseScreen() {
  const nav = useNavigation<Nav>();
  const [ticked, setTicked] = useState([false, false, false]);
  const [elig, setElig] = useState<{ e: ReverseEligibility; usedS: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadEligibility().then((r) => alive && setElig(r));
    return () => {
      alive = false;
    };
  }, []);

  const allTicked = ticked.every(Boolean);
  const start = async () => {
    if (!elig?.e.allowed || !allTicked) return;
    await useBout.getState().start({ usedBeforeS: elig.usedS, targetS: elig.e.boutTargetS });
    nav.replace('ReverseTimer');
  };

  return (
    <Page
      top={<TopBar title="Reverse walk" onLeading={() => nav.goBack()} />}
      footer={
        elig?.e.allowed ? (
          <FilledButton label="Start a bout" leadingIcon="play_arrow" disabled={!allTicked} onPress={() => void start()} />
        ) : undefined
      }
    >
      {elig && !elig.e.allowed ? (
        <Card tone="pc">
          <View style={{ gap: space.s }} testID="reverse-blocked">
            <Icon name="undo" color="opc" />
            <Text variant="title" color="opc" accessibilityRole="header">
              {BLOCK_COPY[elig.e.reason].title}
            </Text>
            <Text color="opc">{BLOCK_COPY[elig.e.reason].body}</Text>
          </View>
        </Card>
      ) : (
        <>
          <Card tone="pc">
            <View style={{ gap: space.s }}>
              <Icon name="undo" color="opc" />
              <Text variant="title" color="opc" accessibilityRole="header">
                Safety check first
              </Text>
              <Text color="opc">
                Walking backwards can help balance and knee comfort, but the research is small and falls are a real risk. Tick each box to start a short, slow bout.
              </Text>
            </View>
          </Card>
          <View style={{ gap: space.s }}>
            {CHECKS.map((label, i) => (
              <CheckboxRow key={label} variant="card" label={label} checked={ticked[i]!} onChange={(v) => setTicked(ticked.map((c, j) => (j === i ? v : c)))} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <StatTile value="15 min" label="Most per day" tone="tc" />
            <StatTile value="5 to 10" label="Minutes per bout" tone="sc" />
          </View>
          {elig?.e.allowed ? <Text color="osv">{`${formatMmSs(elig.e.remainingS)} left today.`}</Text> : null}
        </>
      )}
      <InfoNote text="This option is not shown if you told us about a heart, blood pressure or balance concern." />
    </Page>
  );
}

export function ReverseTimerScreen() {
  const nav = useNavigation<Nav>();
  const bout = useBout();
  const [, force] = useState(0);

  // Nothing running (cold open of this route): go back to Steps.
  useEffect(() => {
    if (bout.status === 'idle') nav.replace('Steps');
  }, [bout.status, nav]);

  // Read the clock twice a second; elapsed time itself comes from the monotonic clock.
  useEffect(() => {
    if (bout.status !== 'running') return undefined;
    const id = setInterval(() => {
      useBout.getState().tick();
      force((n) => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, [bout.status]);

  const finish = useCallback(async () => {
    await useBout.getState().stop('user');
    useBout.getState().reset(); // idle sends us back to Steps
  }, []);

  const done = bout.status === 'finished';
  useEffect(() => {
    if (done && bout.stoppedBy !== 'user') {
      // Auto-stopped (bout length or the 15-minute day). Show the result for a moment, then leave.
      const id = setTimeout(() => {
        useBout.getState().reset();
      }, 4000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [done, bout.stoppedBy]);

  const day = reverseBoutState({ usedBeforeS: bout.usedBeforeS, elapsedS: bout.elapsedS });
  const minutes = Math.floor(bout.elapsedS / 60);
  const target = bout.targetS || REVERSE_BOUT_TARGET_S;

  return (
    <Page
      top={<TopBar leading="close" onLeading={() => void finish()} title="Reverse walk" centerTitle />}
      footer={<FilledButton label="Stop bout" leadingIcon="stop" onPress={() => void finish()} disabled={done} />}
    >
      <View style={{ alignItems: 'center' }}>
        <TimerRing
          remainingMs={Math.max(0, target - bout.elapsedS) * 1000}
          totalMs={target * 1000}
          size={240}
          stroke={16}
          a11yLabel={`${formatMmSs(bout.elapsedS)} of ${formatMmSs(target)}`}
          center={
            <View style={{ alignItems: 'center' }}>
              <Text variant="timer" tabular>
                {formatMmSs(bout.elapsedS)}
              </Text>
              <Text color="osv">{`of ${formatMmSs(target)}`}</Text>
            </View>
          }
        />
      </View>
      {/* Announced once a minute, not every second. */}
      <Text accessibilityLiveRegion="polite" variant="label" color="osv" style={{ textAlign: 'center' }}>
        {done ? (bout.stoppedBy === 'cap' ? "That is today's 15 minutes. Well done." : 'Bout done. Nice and steady.') : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} done`}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <StatTile value={formatCount(bout.steps)} label="Steps in this bout" tone="tc" />
        <StatTile value={formatMmSs(Math.min(REVERSE_DAILY_CAP_S, day.remainingTodayS))} label="Left today (15 max)" tone="sc" />
      </View>
      <WarningBanner text="Slow and steady. Stop if you feel dizzy or unsteady." />
    </Page>
  );
}
