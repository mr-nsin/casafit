import React from 'react';
import { View } from 'react-native';
import { IconButton } from './buttons';
import { SegmentedControl, ToggleRow, type Option } from './selection';
import { Icon, Text, Touchable, type IconName } from './primitives';
import { radius, space } from './tokens';
import { useTokens } from './useTokens';

/** Easier / Same / Harder style radio group with a caption. */
export function IntensityControl<V extends string>({ options, value, onChange, caption, label = 'Intensity' }: { options: Option<V>[]; value: V; onChange: (v: V) => void; caption?: string; label?: string }) {
  return (
    <View style={{ gap: space.s }}>
      <SegmentedControl options={options} value={value} onChange={onChange} height={48} label={label} />
      {caption ? (
        <Text variant="bodySmall" color="osv" accessibilityLiveRegion="polite">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Previous, pause or resume, next. */
export function TransportRow({ paused, onPrev, onToggle, onNext }: { paused: boolean; onPrev?: () => void; onToggle: () => void; onNext?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xxl }}>
      <IconButton icon="skip_previous" label="Previous move" tone="tonal" size={56} onPress={onPrev} disabled={!onPrev} />
      <IconButton icon={paused ? 'play_arrow' : 'pause'} label={paused ? 'Resume' : 'Pause'} tone="filled" size={96} onPress={onToggle} />
      <IconButton icon="skip_next" label="Next move" tone="tonal" size={56} onPress={onNext} disabled={!onNext} />
    </View>
  );
}

/** Move in a list (BodyPart, Plan, Picker, Editor). */
export function ExerciseRow({ title, meta, trailing = 'none', blocked, onPress, onTrailing }: { title: string; meta?: string; trailing?: 'add' | 'remove' | 'none'; blocked?: boolean; onPress?: () => void; onTrailing?: () => void }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, backgroundColor: t.c3, borderRadius: radius.l, paddingLeft: space.l, opacity: blocked ? 0.6 : 1 }}>
      <Touchable label={meta ? `${title}, ${meta}` : title} onPress={onPress} minSize={64} style={{ flex: 1, justifyContent: 'center' }}>
        <Text>{title}</Text>
        {meta ? (
          <Text variant="bodySmall" color="osv">
            {meta}
          </Text>
        ) : null}
      </Touchable>
      {trailing !== 'none' ? (
        <IconButton icon={trailing === 'add' ? 'add' : 'remove'} label={`${trailing === 'add' ? 'Add' : 'Remove'} ${title}`} onPress={onTrailing} tone="tonal" disabled={blocked} />
      ) : null}
    </View>
  );
}

export function HiddenByFlagRow({ exerciseName, reason }: { exerciseName: string; reason: string }) {
  return (
    <View accessible accessibilityLabel={`${exerciseName} is hidden. ${reason}`} style={{ flexDirection: 'row', gap: space.m, alignItems: 'center', minHeight: 48, paddingHorizontal: space.l }}>
      <Icon name="visibility_off" color="osv" size={20} />
      <Text variant="bodySmall" color="osv" style={{ flex: 1 }}>
        {exerciseName}: {reason}
      </Text>
    </View>
  );
}

export function ConsentRow({ icon, purpose, subtitle, value, onChange }: { icon?: IconName; purpose: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleRow icon={icon} title={purpose} subtitle={subtitle} value={value} onChange={onChange} />;
}

export function FormCheckChip({ remaining, onPress }: { remaining: number; onPress: () => void }) {
  const t = useTokens();
  return (
    <Touchable label={`Form check, ${remaining} free left`} onPress={onPress} style={{ height: 44, borderRadius: radius.m, backgroundColor: t.tc, paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center', gap: space.s }}>
      <Icon name="photo_camera" size={18} color="otc" />
      <Text variant="labelStrong" color="otc" tabular>
        {remaining} free
      </Text>
    </Touchable>
  );
}
