import React from 'react';
import { View } from 'react-native';
import { IconButton } from './buttons';
import { Icon, Text, Touchable, type IconName } from './primitives';
import { space } from './tokens';
import { useTokens } from './useTokens';

export type TopBarProps = {
  title?: string;
  subtitle?: string;
  /** 'back' | 'close' | 'none' */
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  /** Step label such as "1 of 2". */
  stepLabel?: string;
  trailing?: { icon: IconName; label: string; onPress: () => void }[];
  trailingText?: { label: string; onPress: () => void };
  right?: React.ReactNode;
  centerTitle?: boolean;
};

export function TopBar({
  title,
  subtitle,
  leading = 'back',
  onLeading,
  stepLabel,
  trailing,
  trailingText,
  right,
  centerTitle,
}: TopBarProps) {
  const t = useTokens();
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s, backgroundColor: t.bg }}>
      {leading !== 'none' ? (
        <IconButton
          icon={leading === 'back' ? 'arrow_back' : 'close'}
          label={leading === 'back' ? 'Back' : 'Close'}
          onPress={onLeading}
        />
      ) : (
        <View style={{ width: space.l }} />
      )}
      <View style={{ flex: 1, paddingHorizontal: space.s, alignItems: centerTitle ? 'center' : 'flex-start' }}>
        {title ? (
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="bodySmall" color="osv" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {stepLabel ? (
        <Text variant="label" color="osv" style={{ marginRight: space.m }}>
          {stepLabel}
        </Text>
      ) : null}
      {trailing?.map((a) => (
        <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />
      ))}
      {trailingText ? (
        <Touchable label={trailingText.label} onPress={trailingText.onPress} minSize={48} style={{ justifyContent: 'center', paddingHorizontal: space.m }}>
          <Text variant="title" color="p" style={{ fontSize: 14 }}>
            {trailingText.label}
          </Text>
        </Touchable>
      ) : null}
      {right}
    </View>
  );
}

export type TabKey = 'workout' | 'nutrition' | 'progress';
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'workout', label: 'Workout', icon: 'sports_gymnastics' },
  { key: 'nutrition', label: 'Nutrition', icon: 'restaurant' },
  { key: 'progress', label: 'Progress', icon: 'bar_chart' },
];

/** Three-tab bottom navigation, 80 px, selected tab has a 64x32 pill. `current` may be null. */
export function BottomNav({ current, onSelect }: { current: TabKey | null; onSelect?: (k: TabKey) => void }) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="tablist"
      style={{ height: 80, backgroundColor: t.c2, flexDirection: 'row', paddingTop: space.m }}
    >
      {TABS.map((tab) => {
        const sel = tab.key === current;
        return (
          <Touchable
            key={tab.key}
            role="tab"
            label={tab.label}
            selected={sel}
            minSize={48}
            onPress={() => onSelect?.(tab.key)}
            style={{ flex: 1, alignItems: 'center', gap: space.xs }}
          >
            <View
              style={{
                width: 64,
                height: 32,
                borderRadius: 16,
                backgroundColor: sel ? t.sc : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={tab.icon} color={sel ? 'osc' : 'osv'} />
            </View>
            <Text variant={sel ? 'labelStrong' : 'label'} color={sel ? 'on' : 'osv'}>
              {tab.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}
