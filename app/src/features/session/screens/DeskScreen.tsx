// Desk reset: a 4-minute seated micro-session. It has its own tiny clock and never touches
// the session store, the streak or SessionLog (micro sessions count to active minutes only).

import { useEffect, useReducer, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, space, type } from '../../../theme';
import { Btn, InfoNote, Screen, Stage, TimerRing, TopBar } from '../components';
import { getSessionDeps } from '../deps';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface DeskMove {
  id: string;
  name: string;
  cue: string;
  /** Total seconds. Moves with sides spend half on each. */
  durationS: number;
  sides: boolean;
}

export const DESK_MOVES: readonly DeskMove[] = [
  { id: 'desk-shoulder-roll', name: 'Shoulder rolls', cue: 'Roll back slowly, then forward.', durationS: 60, sides: false },
  { id: 'desk-neck-release', name: 'Neck release', cue: 'Ear towards shoulder. Let the head hang.', durationS: 60, sides: true },
  { id: 'desk-seated-twist', name: 'Seated twist', cue: 'Sit tall, turn from the ribs.', durationS: 60, sides: true },
  { id: 'desk-wrist-stretch', name: 'Wrist stretch', cue: 'Arm out, palm up, gentle pull.', durationS: 60, sides: true },
];

/** Where a micro session is after `elapsedMs`. Pure, so it can be tested with a fake clock. */
export function deskPosition(moves: readonly DeskMove[], elapsedMs: number) {
  let t = 0;
  for (let i = 0; i < moves.length; i += 1) {
    const m = moves[i]!;
    const end = t + m.durationS * 1000;
    if (elapsedMs < end) {
      const into = elapsedMs - t;
      const half = (m.durationS * 1000) / 2;
      const side = m.sides ? (into < half ? 'Left side' : 'Right side') : null;
      const segEnd = m.sides ? (into < half ? t + half : end) : end;
      return { done: false as const, index: i, move: m, side, remainingMs: segEnd - elapsedMs, segmentMs: m.sides ? half : m.durationS * 1000 };
    }
    t = end;
  }
  return { done: true as const, index: moves.length - 1, move: moves[moves.length - 1]!, side: null, remainingMs: 0, segmentMs: 0 };
}

export function DeskScreen({ moves = DESK_MOVES }: { moves?: readonly DeskMove[] }) {
  const nav = useNavigation<Nav>();
  const deps = getSessionDeps();
  const [startMono] = useState(() => deps.clock.now());
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const logged = useRef(false);
  // "Next move" jumps the displayed position forward without changing real active time.
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(bump, 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = deps.clock.now() - startMono + offset;
  const pos = deskPosition(moves, elapsed);
  const realActiveMs = deps.clock.now() - startMono;

  const finish = () => {
    if (!logged.current) {
      logged.current = true;
      const activeS = Math.round(Math.min(realActiveMs, moves.reduce((a, m) => a + m.durationS * 1000, 0)) / 1000);
      if (activeS > 0) void deps.micro.insert({ id: deps.newId(), planId: 'desk', activeS, at: deps.clock.wall() });
    }
    nav.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  useEffect(() => {
    if (pos.done) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.done]);

  const next = () => {
    let t = 0;
    for (let i = 0; i <= pos.index; i += 1) t += moves[i]!.durationS * 1000;
    setOffset((o) => o + t - elapsed);
  };

  return (
    <Screen>
      <TopBar title={`Move ${pos.index + 1} of ${moves.length}`} subtitle="Desk reset · 4 min" onClose={finish} closeLabel="Close" />
      <Stage icon="chair" description={`${pos.move.name}, seated`} pill="Quiet · no sweat" />
      <Text style={[type.headline, { color: dark.on, fontSize: 28 }]} accessibilityRole="header">
        {pos.move.name}
      </Text>
      <Text style={[type.body, { color: dark.osv }]}>{pos.move.cue}</Text>
      <View style={{ alignItems: 'center', marginVertical: space.l }}>
        <TimerRing
          size={160}
          remainingMs={pos.remainingMs}
          totalMs={pos.segmentMs}
          centre={formatClock(pos.remainingMs)}
          sub={pos.side ?? undefined}
          label={`${formatClock(pos.remainingMs)} left${pos.side ? `, ${pos.side}` : ''}`}
        />
      </View>
      <InfoNote>Short breaks add up. They count toward your active minutes, not your 15-minute session.</InfoNote>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <View style={{ flex: 1 }}>
          <Btn label="Skip" kind="outline" onPress={finish} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Next move" onPress={next} />
        </View>
      </View>
    </Screen>
  );
}
