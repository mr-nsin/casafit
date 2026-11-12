import { fireEvent, render, screen } from '@testing-library/react-native';

import { HeightInput, WeightInput, cmToFtIn, parseHeightCm, parseHeightFtIn, parseWeightKg, parseWeightLb, DayPill } from '..';

describe('height and weight maths', () => {
  it('converts feet and inches to cm and back', () => {
    expect(parseHeightFtIn('5', '7')).toEqual({ value: 170 });
    expect(parseHeightFtIn('', '')).toEqual({ value: null });
    expect(cmToFtIn(170)).toEqual({ feet: 5, inches: 7 });
    expect(cmToFtIn(183)).toEqual({ feet: 6, inches: 0 });
  });
  it('keeps the 80 to 260 cm range, with a plain message', () => {
    expect(parseHeightCm('79').error).toMatch(/between 80 and 260 cm/);
    expect(parseHeightCm('261').error).toBeTruthy();
    expect(parseHeightCm('80')).toEqual({ value: 80 });
    expect(parseHeightFtIn('2', '6').error).toMatch(/between 2 ft 8 in and 8 ft 6 in/);
    expect(parseHeightFtIn('8', '7').error).toBeTruthy();
    expect(parseHeightFtIn('5', '12').error).toMatch(/0 to 11/);
    expect(parseHeightFtIn('x', '1').error).toBeTruthy();
  });
  it('converts pounds to kg', () => {
    expect(parseWeightLb('150')).toEqual({ value: 68 });
    expect(parseWeightLb('10').error).toBeTruthy();
    expect(parseWeightKg('19').error).toBeTruthy();
  });
});

describe('HeightInput', () => {
  it('starts in ft / in, emits cm, and converts when the unit changes', async () => {
    const onChange = jest.fn();
    await render(<HeightInput valueCm={null} onChange={onChange} testID="h" />);
    expect(screen.getByRole('radio', { name: 'ft / in' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.changeText(screen.getByTestId('h-ft'), '5');
    await fireEvent.changeText(screen.getByTestId('h-in'), '10');
    expect(onChange).toHaveBeenLastCalledWith(178, undefined);
    await fireEvent.press(screen.getByRole('radio', { name: 'cm' }));
    expect(screen.getByTestId('h').props.value).toBe('178');
    await fireEvent.changeText(screen.getByTestId('h'), '300');
    expect(onChange).toHaveBeenLastCalledWith(null, expect.stringMatching(/80 and 260/));
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('shows a saved height as feet and inches', async () => {
    await render(<HeightInput valueCm={165} onChange={jest.fn()} testID="h" />);
    expect(screen.getByTestId('h-ft').props.value).toBe('5');
    expect(screen.getByTestId('h-in').props.value).toBe('5');
  });
});

describe('WeightInput', () => {
  it('emits kg from lb', async () => {
    const onChange = jest.fn();
    await render(<WeightInput valueKg={null} onChange={onChange} testID="w" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
    await fireEvent.changeText(screen.getByTestId('w'), '132');
    expect(onChange).toHaveBeenLastCalledWith(59.9, undefined);
  });
});

describe('DayPill', () => {
  it('is a button only when it has an action', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <DayPill day="Mon" kind="planned" />
        <DayPill day="Tue" kind="planned" onPress={onPress} />
      </>,
    );
    expect(screen.queryByRole('button', { name: /^Mon/ })).toBeNull();
    expect(screen.getByLabelText('Mon')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Tue/ }));
    expect(onPress).toHaveBeenCalled();
  });
});
