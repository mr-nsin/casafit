import React, { useRef, useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { IconButton } from './buttons';
import { Icon, Text, Touchable } from './primitives';
import { fontFamily, radius, space } from './tokens';
import { useTokens } from './useTokens';

type FieldShellProps = {
  label: string;
  error?: string;
  helper?: string;
  /** Dashed border marks an optional field. */
  optional?: boolean;
  focused?: boolean;
  children: React.ReactNode;
  suffix?: React.ReactNode;
};

function FieldShell({ label, error, helper, optional, focused, children, suffix }: FieldShellProps) {
  const t = useTokens();
  const border = error ? t.er : focused ? t.p : t.ol;
  return (
    <View>
      <View
        style={{
          minHeight: 56,
          borderRadius: radius.xs + 2,
          borderWidth: focused ? 2 : 1,
          borderColor: border,
          borderStyle: optional ? 'dashed' : 'solid',
          paddingHorizontal: space.l,
          paddingTop: space.s,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" color={error ? 'er' : focused ? 'p' : 'osv'}>
            {optional ? `${label} (optional)` : label}
          </Text>
          {children}
        </View>
        {suffix}
      </View>
      {error || helper ? (
        <Text
          variant="label"
          color={error ? 'er' : 'osv'}
          accessibilityRole={error ? 'alert' : undefined}
          style={{ marginTop: space.xs, marginLeft: space.l }}
        >
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}

export type TextFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  helper?: string;
  optional?: boolean;
  suffix?: string;
  placeholder?: string;
  secure?: boolean;
  testID?: string;
} & Pick<
  TextInputProps,
  'autoComplete' | 'maxLength' | 'onFocus' | 'autoCapitalize' | 'autoCorrect' | 'autoFocus' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing'
>;

export function TextField({ label, value, onChange, keyboardType, error, helper, optional, suffix, placeholder, secure, testID, ...rest }: TextFieldProps) {
  const t = useTokens();
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell
      label={label}
      error={error}
      helper={helper}
      optional={optional}
      focused={focused}
      suffix={suffix ? <Text color="osv">{suffix}</Text> : null}
    >
      <TextInput
        {...rest}
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={t.ol}
        secureTextEntry={secure}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={() => setFocused(false)}
        style={{ fontFamily, fontSize: 16, color: t.on, minHeight: 28, padding: 0 }}
      />
    </FieldShell>
  );
}

/** Looks like a field, opens a picker on press (year of birth, country code). */
export function SelectField({ label, valueLabel, onPress }: { label: string; valueLabel?: string; onPress: () => void }) {
  return (
    <Touchable
      role="button"
      label={`${label}, ${valueLabel ?? 'not set'}`}
      onPress={onPress}
      minSize={56}
      style={{ borderRadius: radius.xs + 2 }}
    >
      <FieldShell label={label} suffix={<Icon name="arrow_drop_down" color="osv" />}>
        <Text style={{ minHeight: 28 }}>{valueLabel ?? ' '}</Text>
      </FieldShell>
    </Touchable>
  );
}

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search',
  label = 'Search',
  onFocus,
  trailing,
  onTrailing,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  onFocus?: () => void;
  trailing?: 'mic';
  onTrailing?: () => void;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        height: 56,
        borderRadius: 28,
        backgroundColor: t.c4,
        paddingLeft: space.l,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
      }}
    >
      <Icon name="search" color="osv" />
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={t.ol}
        returnKeyType="search"
        style={{ flex: 1, fontFamily, fontSize: 16, color: t.on, padding: 0 }}
      />
      {value.length > 0 ? (
        <IconButton icon="close" label="Clear search" onPress={() => (onClear ? onClear() : onChange(''))} />
      ) : trailing === 'mic' ? (
        <IconButton icon="mic" label="Search by voice" onPress={onTrailing} />
      ) : null}
    </View>
  );
}

/** One input driving N visual digit boxes. */
export function OtpField({
  length = 6,
  value,
  onChange,
  state = 'idle',
  autoRead,
  autoFocus,
  errorText,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  state?: 'idle' | 'error' | 'filled';
  autoRead?: boolean;
  /** Open the keyboard as soon as the field mounts. */
  autoFocus?: boolean;
  /** Text under the boxes in the error state. Pass null when the screen shows its own message. */
  errorText?: string | null;
}) {
  const t = useTokens();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const digits = value.split('');
  const border = state === 'error' ? t.er : t.ol;
  return (
    <View>
      <Touchable
        role="none"
        label={`One-time code, ${value.length} of ${length} digits entered`}
        onPress={() => ref.current?.focus()}
        minSize={56}
        style={{ flexDirection: 'row', gap: space.s, justifyContent: 'space-between' }}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 56,
              borderRadius: radius.m,
              borderWidth: i === digits.length && state !== 'error' ? 2 : 1,
              borderColor: i === digits.length && state !== 'error' ? t.p : border,
              backgroundColor: state === 'filled' ? t.pc : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="headline" tabular>
              {digits[i] ?? ''}
            </Text>
          </View>
        ))}
      </Touchable>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={autoRead ? 'sms-otp' : 'off'}
        maxLength={length}
        autoFocus={autoFocus}
        accessibilityLabel="One-time code input"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      {state === 'error' && errorText !== null ? (
        <Text variant="label" color="er" accessibilityRole="alert" style={{ marginTop: space.xs }}>
          {errorText ?? 'That code did not match. Check it and try again.'}
        </Text>
      ) : null}
    </View>
  );
}

/** Discrete slider: a 8 px track with tappable 44 px steps, adjustable for screen readers. */
export function SliderField({
  min,
  max,
  value,
  onChange,
  label,
  unit,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
}) {
  const t = useTokens();
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: unit ? `${value} ${unit}` : String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const d = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(Math.min(max, Math.max(min, value + d)));
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.s }}>
        <Text>{label}</Text>
        <Text variant="title" color="p" tabular>
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {steps.map((s) => (
          <Touchable
            key={s}
            role="button"
            label={`${s}`}
            importantForAccessibility="no"
            onPress={() => onChange(s)}
            style={{ flex: 1, height: 44, justifyContent: 'center' }}
          >
            <View style={{ height: 8, backgroundColor: s <= value ? t.p : t.sv, borderRadius: s === min ? 4 : 0 }} />
          </Touchable>
        ))}
      </View>
    </View>
  );
}
