import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Icon, Text, Touchable, type IconName } from './primitives';
import { radius, space } from './tokens';
import { useTokens } from './useTokens';

export type Option<V extends string = string> = { value: V; label: string; icon?: IconName; disabled?: boolean };

/** Filter/choice chip, 44 px, check icon when selected. */
export function Chip({
  label,
  selected = false,
  onPress,
  role = 'checkbox',
  icon,
  tone = 'sc',
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  role?: 'checkbox' | 'radio' | 'button';
  icon?: IconName;
  tone?: 'sc' | 'tc';
  disabled?: boolean;
}) {
  const t = useTokens();
  const bg = selected ? (tone === 'tc' ? t.tc : t.sc) : 'transparent';
  const fg = selected ? (tone === 'tc' ? 'otc' : 'osc') : 'osv';
  return (
    <Touchable
      role={role}
      label={label}
      selected={role === 'radio' || role === 'button' ? selected : undefined}
      checked={role === 'checkbox' ? selected : undefined}
      onPress={onPress}
      disabled={disabled}
      minSize={44}
      style={{
        height: 44,
        borderRadius: radius.m,
        borderWidth: selected ? 0 : 1,
        borderColor: t.ol,
        backgroundColor: bg,
        paddingHorizontal: space.l,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s,
      }}
    >
      {selected ? <Icon name="check" size={18} color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text variant="label" color={fg} style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Touchable>
  );
}

/** Single- or multi-select chip group. `exclusive` is a value that clears the others (e.g. "none"). */
export function ChipGroup<V extends string>({
  options,
  selected,
  onChange,
  multi = false,
  exclusive,
  scrollable = false,
  label,
}: {
  options: Option<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
  multi?: boolean;
  exclusive?: V;
  scrollable?: boolean;
  label?: string;
}) {
  const toggle = (v: V) => {
    if (!multi) return onChange([v]);
    if (v === exclusive) return onChange(selected.includes(v) ? [] : [v]);
    const base = selected.filter((s) => s !== exclusive);
    onChange(base.includes(v) ? base.filter((s) => s !== v) : [...base, v]);
  };
  const chips = options.map((o) => (
    <Chip
      key={o.value}
      label={o.label}
      icon={o.icon}
      disabled={o.disabled}
      role={multi ? 'checkbox' : 'radio'}
      selected={selected.includes(o.value)}
      onPress={() => toggle(o.value)}
    />
  ));
  const container = { flexDirection: 'row', flexWrap: scrollable ? 'nowrap' : 'wrap', gap: space.s } as const;
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} contentContainerStyle={container}>
      {chips}
    </ScrollView>
  ) : (
    <View accessibilityLabel={label} accessibilityRole={multi ? undefined : 'radiogroup'} style={container}>
      {chips}
    </View>
  );
}

/** Segmented control, 44 or 48 px tall. Radio semantics. */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  height = 44,
  label,
}: {
  options: Option<V>[];
  value: V;
  onChange: (v: V) => void;
  height?: 44 | 48;
  label?: string;
}) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: t.ol, borderRadius: height / 2, overflow: 'hidden' }}
    >
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Touchable
            key={o.value}
            role="radio"
            label={o.label}
            selected={sel}
            disabled={o.disabled}
            minSize={height}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              height,
              backgroundColor: sel ? t.sc : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: space.xs,
            }}
          >
            {sel ? <Icon name="check" size={16} color="osc" /> : null}
            <Text variant="label" color={sel ? 'osc' : 'osv'} style={{ fontSize: 14 }}>
              {o.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/** Tabs (Myths | Concepts | Form tips, day tabs). `role=tablist`, 44 px. */
export function Tabs<V extends string>({
  items,
  selected,
  onSelect,
  scrollable = false,
}: {
  items: Option<V>[];
  selected: V;
  onSelect: (v: V) => void;
  scrollable?: boolean;
}) {
  const t = useTokens();
  const content = items.map((it) => {
    const sel = it.value === selected;
    return (
      <Touchable
        key={it.value}
        role="tab"
        label={it.label}
        selected={sel}
        onPress={() => onSelect(it.value)}
        style={{
          flex: scrollable ? undefined : 1,
          height: 44,
          paddingHorizontal: space.l,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 3,
          borderBottomColor: sel ? t.p : 'transparent',
        }}
      >
        <Text variant="title" color={sel ? 'p' : 'osv'} style={{ fontSize: 14 }}>
          {it.label}
        </Text>
      </Touchable>
    );
  });
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
      {content}
    </ScrollView>
  ) : (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row' }}>
      {content}
    </View>
  );
}

/** Icon + label card (goal cards 96 high, style tiles 112 high). */
export function ChoiceCard({
  icon,
  label,
  selected,
  onPress,
  size = 'card',
  role = 'radio',
}: {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'card' | 'tile';
  role?: 'radio' | 'checkbox';
}) {
  const t = useTokens();
  const tile = size === 'tile';
  return (
    <Touchable
      role={role}
      label={label}
      selected={role === 'radio' ? selected : undefined}
      checked={role === 'checkbox' ? selected : undefined}
      onPress={onPress}
      style={{
        height: tile ? 112 : 96,
        borderRadius: radius.xl,
        backgroundColor: selected ? t.pc : t.c3,
        padding: space.l,
        flexDirection: tile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: tile ? 'center' : 'flex-start',
        gap: space.m,
      }}
    >
      <Icon name={icon} size={tile ? 32 : 28} color={selected ? 'opc' : 'osv'} />
      <Text variant="title" color={selected ? 'opc' : 'on'} style={{ flex: tile ? undefined : 1, fontSize: 16 }}>
        {label}
      </Text>
      {selected && !tile ? <Icon name="check_circle" color="opc" /> : null}
    </Touchable>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  variant = 'plain',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  variant?: 'plain' | 'card';
}) {
  const t = useTokens();
  return (
    <Touchable
      role="checkbox"
      label={label}
      checked={checked}
      onPress={() => onChange(!checked)}
      minSize={48}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingVertical: space.s,
        paddingHorizontal: variant === 'card' ? space.l : 0,
        borderWidth: variant === 'card' ? 1 : 0,
        borderColor: checked ? t.p : t.olv,
        borderRadius: radius.l,
        minHeight: variant === 'card' ? 64 : 48,
      }}
    >
      <Icon name={checked ? 'check_box' : 'check_box_outline_blank'} color={checked ? 'p' : 'osv'} />
      <Text style={{ flex: 1 }}>{label}</Text>
    </Touchable>
  );
}

/** Row with a Switch. Tapping the row toggles. Minimum 64 px as in the specs. */
export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  a11yLabel,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  a11yLabel?: string;
}) {
  const t = useTokens();
  return (
    <Touchable
      role="switch"
      label={a11yLabel ?? title}
      checked={value}
      onPress={() => onChange(!value)}
      minSize={64}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.l, paddingVertical: space.s }}
    >
      {icon ? <Icon name={icon} color="osv" /> : null}
      <View style={{ flex: 1 }}>
        <Text>{title}</Text>
        {subtitle ? (
          <Text variant="bodySmall" color="osv">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessible={false}
        trackColor={{ true: t.p, false: t.sv }}
        thumbColor={value ? t.op : t.ol}
      />
    </Touchable>
  );
}
export const SwitchRow = ToggleRow;
export const SettingSwitchRow = ToggleRow;

export type RadioOption = { id: string; label: string; native?: string; badge?: string; disabled?: boolean };

export function RadioList({ options, value, onChange }: { options: RadioOption[]; value: string; onChange: (id: string) => void }) {
  const t = useTokens();
  return (
    <View accessibilityRole="radiogroup">
      {options.map((o) => {
        const sel = o.id === value;
        return (
          <Touchable
            key={o.id}
            role="radio"
            label={o.native ? `${o.native}, ${o.label}` : o.label}
            selected={sel}
            disabled={o.disabled}
            onPress={() => onChange(o.id)}
            minSize={64}
            style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.l }}
          >
            <Icon name={sel ? 'radio_button_checked' : 'radio_button_unchecked'} color={sel ? 'p' : 'osv'} />
            <View style={{ flex: 1 }}>
              <Text>{o.native ?? o.label}</Text>
              {o.native ? (
                <Text variant="bodySmall" color="osv">
                  {o.label}
                </Text>
              ) : null}
            </View>
            {o.badge ? (
              <View style={{ backgroundColor: t.tc, borderRadius: radius.s, paddingHorizontal: space.s, paddingVertical: 2 }}>
                <Text variant="label" color="otc">
                  {o.badge}
                </Text>
              </View>
            ) : null}
          </Touchable>
        );
      })}
    </View>
  );
}

/** Minus / plus stepper with a live count. 48 px buttons. */
export function Stepper({
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  unit,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  label: string;
}) {
  const t = useTokens();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const btn = (icon: IconName, name: string, next: number, off: boolean) => (
    <Touchable
      label={`${name} ${label}`}
      onPress={() => onChange(clamp(next))}
      disabled={off}
      minSize={48}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.sc, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color="osc" />
    </Touchable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
      {btn('remove', 'Decrease', value - step, value <= min)}
      <Text
        variant="title"
        tabular
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: unit ? `${value} ${unit}` : String(value) }}
        accessibilityLiveRegion="polite"
        style={{ minWidth: 40, textAlign: 'center' }}
      >
        {value}
        {unit ? ` ${unit}` : ''}
      </Text>
      {btn('add', 'Increase', value + step, value >= max)}
    </View>
  );
}
