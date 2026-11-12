import React, { useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl } from './selection';
import { TextField } from './fields';
import { Text } from './primitives';
import { space } from './tokens';
import {
  cmToFtIn,
  kgToLb,
  parseHeightCm,
  parseHeightFtIn,
  parseWeightKg,
  parseWeightLb,
  type Parsed,
} from './measureMath';

type HeightUnit = 'ftin' | 'cm';
type WeightUnit = 'kg' | 'lb';

/**
 * Height with a unit switch: feet and inches (default) or cm. The parent always gets cm, or null
 * when empty or invalid, plus the error text (also shown under the field).
 */
export function HeightInput({
  valueCm,
  onChange,
  optional,
  helper,
  testID = 'height',
}: {
  /** Saved value to start from. Later edits stay inside the component. */
  valueCm?: number | null;
  onChange: (cm: number | null, error?: string) => void;
  optional?: boolean;
  helper?: string;
  testID?: string;
}) {
  const [unit, setUnit] = useState<HeightUnit>('ftin');
  const init = valueCm ? cmToFtIn(valueCm) : null;
  const [feet, setFeet] = useState(init ? String(init.feet) : '');
  const [inches, setInches] = useState(init ? String(init.inches) : '');
  const [cm, setCm] = useState(valueCm ? String(valueCm) : '');
  const [error, setError] = useState<string | undefined>();

  const emit = (p: Parsed) => {
    setError(p.error);
    onChange(p.value, p.error);
  };
  const switchUnit = (next: HeightUnit) => {
    if (next === unit) return;
    const current = unit === 'cm' ? parseHeightCm(cm) : parseHeightFtIn(feet, inches);
    if (current.value != null) {
      if (next === 'cm') setCm(String(current.value));
      else {
        const f = cmToFtIn(current.value);
        setFeet(String(f.feet));
        setInches(String(f.inches));
      }
    }
    setUnit(next);
    setError(undefined);
    if (current.error) onChange(null, undefined);
  };

  return (
    <View style={{ gap: space.s }}>
      <Text variant="label" color="osv">
        Height
      </Text>
      <SegmentedControl
        label="Height unit"
        value={unit}
        onChange={switchUnit}
        options={[
          { value: 'ftin', label: 'ft / in' },
          { value: 'cm', label: 'cm' },
        ]}
      />
      {unit === 'ftin' ? (
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Feet"
              suffix="ft"
              value={feet}
              onChange={(v) => {
                setFeet(v);
                emit(parseHeightFtIn(v, inches));
              }}
              keyboardType="number-pad"
              maxLength={1}
              optional={optional}
              testID={`${testID}-ft`}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Inches"
              suffix="in"
              value={inches}
              onChange={(v) => {
                setInches(v);
                emit(parseHeightFtIn(feet, v));
              }}
              keyboardType="decimal-pad"
              maxLength={4}
              optional={optional}
              testID={`${testID}-in`}
            />
          </View>
        </View>
      ) : (
        <TextField
          label="Height, cm"
          suffix="cm"
          value={cm}
          onChange={(v) => {
            setCm(v);
            emit(parseHeightCm(v));
          }}
          keyboardType="number-pad"
          maxLength={3}
          optional={optional}
          testID={testID}
        />
      )}
      {error ? (
        <Text variant="label" color="er" accessibilityRole="alert" style={{ marginLeft: space.s }}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="label" color="osv" style={{ marginLeft: space.s }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

/** Weight with a unit switch: kg (default) or lb. The parent always gets kg. */
export function WeightInput({
  valueKg,
  onChange,
  optional,
  helper,
  testID = 'weight',
}: {
  valueKg?: number | null;
  onChange: (kg: number | null, error?: string) => void;
  optional?: boolean;
  helper?: string;
  testID?: string;
}) {
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [text, setText] = useState(valueKg ? String(valueKg) : '');
  const [error, setError] = useState<string | undefined>();
  const parse = (u: WeightUnit, v: string) => (u === 'kg' ? parseWeightKg(v) : parseWeightLb(v));

  const switchUnit = (next: WeightUnit) => {
    if (next === unit) return;
    const current = parse(unit, text);
    if (current.value != null) setText(String(next === 'lb' ? kgToLb(current.value) : current.value));
    setUnit(next);
    setError(undefined);
    if (current.error) onChange(null, undefined);
  };

  return (
    <View style={{ gap: space.s }}>
      <Text variant="label" color="osv">
        Weight
      </Text>
      <SegmentedControl
        label="Weight unit"
        value={unit}
        onChange={switchUnit}
        options={[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lb' },
        ]}
      />
      <TextField
        label={unit === 'kg' ? 'Weight, kg' : 'Weight, lb'}
        suffix={unit}
        value={text}
        onChange={(v) => {
          setText(v);
          const p = parse(unit, v);
          setError(p.error);
          onChange(p.value, p.error);
        }}
        keyboardType="decimal-pad"
        maxLength={5}
        optional={optional}
        error={error}
        helper={helper}
        testID={testID}
      />
    </View>
  );
}
