import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Text, Touchable, type IconName } from './primitives';
import type { Haptic } from './haptics';
import { curve, radius, space, type ColorKey } from './tokens';
import { useTokens } from './useTokens';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** 48, 52 or 56. 56 is the primary size and is drawn 54 high as a full pill. */
  height?: 48 | 52 | 56;
  tone?: 'primary' | 'tertiary';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

type Kind = 'filled' | 'tonal' | 'outlined' | 'text' | 'destructive';

function Base({ kind, ...p }: ButtonProps & { kind: Kind }) {
  const t = useTokens();
  const { label, onPress, leadingIcon, trailingIcon, disabled, loading, height = 56, tone = 'primary', style } = p;
  const palette: Record<Kind, { bg: string; fg: ColorKey; border?: string }> = {
    filled: tone === 'tertiary' ? { bg: t.t, fg: 'ot' } : { bg: t.p, fg: 'op' },
    // Secondary buttons sit on the elevated surface with a hairline, so they read on peach and apricot cards.
    tonal: { bg: t.el, fg: 'on', border: t.olv },
    outlined: { bg: 'transparent', fg: 'p', border: t.ol },
    text: { bg: 'transparent', fg: 'p' },
    destructive: { bg: t.er, fg: 'op' },
  };
  const c = palette[kind];
  const h = height === 56 ? 54 : height;
  const buzz: Haptic = kind === 'filled' || kind === 'destructive' ? 'tap' : 'none';
  return (
    <Touchable
      label={label}
      accessibilityHint={p.accessibilityHint}
      testID={p.testID}
      onPress={loading ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityState={{ busy: !!loading }}
      haptic={buzz}
      minSize={kind === 'text' ? 48 : h}
      style={[
        {
          height: kind === 'text' ? undefined : h,
          borderRadius: radius.round,
          ...curve,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          paddingHorizontal: space.xxl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t[c.fg]} />
      ) : (
        <>
          {leadingIcon ? <Icon name={leadingIcon} size={20} color={c.fg} /> : null}
          <Text variant="title" color={c.fg} style={{ fontSize: 16 }}>
            {label}
          </Text>
          {trailingIcon ? <Icon name={trailingIcon} size={20} color={c.fg} /> : null}
        </>
      )}
    </Touchable>
  );
}

export const FilledButton = (p: ButtonProps) => <Base kind="filled" {...p} />;
export const PrimaryButton = FilledButton;
export const TonalButton = (p: ButtonProps) => <Base kind="tonal" {...p} />;
export const OutlinedButton = (p: ButtonProps) => <Base kind="outlined" {...p} />;
export const TextButton = (p: ButtonProps) => <Base kind="text" {...p} />;
export const DestructiveButton = (p: ButtonProps) => <Base kind="destructive" {...p} />;

export function IconButton({
  icon,
  label,
  onPress,
  size = 48,
  tone = 'plain',
  disabled,
  testID,
}: {
  icon: IconName;
  /** Required: icon buttons have no visible text. */
  label: string;
  onPress?: () => void;
  size?: 48 | 56 | 96;
  tone?: 'plain' | 'tonal' | 'filled';
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTokens();
  const bg = tone === 'filled' ? t.p : tone === 'tonal' ? t.el : 'transparent';
  const fg: ColorKey = tone === 'filled' ? 'op' : 'on';
  return (
    <Touchable
      label={label}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      minSize={size}
      haptic={tone === 'filled' ? 'tap' : 'none'}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: tone === 'tonal' ? 1 : 0, borderColor: t.olv, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={size >= 96 ? 48 : 24} color={fg} />
    </Touchable>
  );
}

export function Fab({ label, icon, onPress }: { label: string; icon: IconName; onPress?: () => void }) {
  const t = useTokens();
  return (
    <Touchable
      label={label}
      onPress={onPress}
      minSize={56}
      style={{
        height: 56,
        borderRadius: radius.round,
        backgroundColor: t.pc,
        paddingHorizontal: space.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s,
      }}
    >
      <Icon name={icon} color="opc" />
      <Text variant="title" color="opc" style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Touchable>
  );
}

/** Row of buttons, e.g. primary + outlined at the bottom of a screen. */
export function ButtonPair({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: space.m }}>{children}</View>;
}
