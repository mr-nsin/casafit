import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import {
  Accordion, Badge, BenefitRow, BigTimer, BottomNav, BottomSheet, Chip, ChipGroup, CheckboxRow, ChecklistItem, ChoiceCard,
  ConfirmDialog, CreditBadge, EmptyState, FilledButton, Heatmap, Icon, IconButton, IntensityControl, ListRow, OtpField,
  PaywallPlanCard, ProgressBar, ProgressRing, SearchField, SegmentedControl, SegmentedProgress, SessionSegmentBar, SliderField,
  StatTile, StatusBanner, Stepper, Tabs, TextButton, TextField, ToggleRow, TopBar, VerdictChip, WeekBars, WeekDots,
} from '..';

describe('buttons', () => {
  it('fires onPress, exposes label and 44+ px target', async () => {
    const onPress = jest.fn();
    await render(<FilledButton label="Start today" onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Start today' });
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
    const style = Object.assign({}, ...[b.props.style].flat(5).filter(Boolean));
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
  it('does not fire while loading or disabled', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <FilledButton label="A" onPress={onPress} loading />
        <TextButton label="B" onPress={onPress} disabled />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'A' }));
    await fireEvent.press(screen.getByRole('button', { name: 'B' }));
    expect(onPress).not.toHaveBeenCalled();
  });
  it('icon buttons require an accessible label', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="settings" label="Settings" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('rejects the dumbbell icon', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Icon name="fitness_center" />)).rejects.toThrow(/fitness_center/);
  });
});

describe('navigation', () => {
  it('TopBar back and title', async () => {
    const onBack = jest.fn();
    await render(<TopBar title="About you" stepLabel="2 of 2" onLeading={onBack} />);
    expect(screen.getByRole('header')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });
  it('BottomNav marks the current tab selected and reports taps', async () => {
    const onSelect = jest.fn();
    await render(<BottomNav current="nutrition" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Nutrition', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Workout', selected: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Progress' }));
    expect(onSelect).toHaveBeenCalledWith('progress');
  });
  it('BottomNav has three tabs and allows no current tab', async () => {
    await render(<BottomNav current={null} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});

describe('selection', () => {
  it('Chip toggles with checkbox semantics', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Knees" selected onPress={onPress} />);
    expect(screen.getByRole('checkbox', { name: 'Knees', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Knees' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('ChipGroup exclusive "none" clears the others', async () => {
    function Harness() {
      const [s, setS] = useState<string[]>(['knees']);
      return (
        <ChipGroup
          multi
          exclusive="none"
          options={[{ value: 'none', label: 'None' }, { value: 'knees', label: 'Knees' }, { value: 'back', label: 'Back' }]}
          selected={s}
          onChange={setS}
        />
      );
    }
    await render(<Harness />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Back' }));
    expect(screen.getByRole('checkbox', { name: 'Back', checked: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Knees', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'None' }));
    expect(screen.getByRole('checkbox', { name: 'None', checked: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Knees', checked: false })).toBeTruthy();
  });
  it('SegmentedControl and Tabs report changes', async () => {
    const onChange = jest.fn();
    const onSelect = jest.fn();
    await render(
      <>
        <SegmentedControl options={[{ value: 'a', label: 'Woman' }, { value: 'b', label: 'Man' }]} value="a" onChange={onChange} />
        <Tabs items={[{ value: 'm', label: 'Myths' }, { value: 'c', label: 'Concepts' }]} selected="m" onSelect={onSelect} />
      </>,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Man' }));
    expect(onChange).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getByRole('tab', { name: 'Concepts' }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });
  it('ChoiceCard, CheckboxRow, ToggleRow', async () => {
    const a = jest.fn();
    const b = jest.fn();
    const c = jest.fn();
    await render(
      <>
        <ChoiceCard icon="self_improvement" label="Stay fit" selected={false} onPress={a} />
        <CheckboxRow checked={false} onChange={b} label="I am 18 or older" />
        <ToggleRow title="Sunday recap" value={false} onChange={c} />
      </>,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Stay fit' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I am 18 or older' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Sunday recap' }));
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(true);
    expect(c).toHaveBeenCalledWith(true);
  });
  it('Stepper clamps at the bounds', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Yoga days" value={0} min={0} max={3} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Yoga days' }));
    expect(onChange).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Yoga days' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('IntensityControl shows its caption', async () => {
    await render(<IntensityControl options={[{ value: 'e', label: 'Easier' }, { value: 's', label: 'Same' }]} value="s" onChange={() => undefined} caption="Pace stays steady" />);
    expect(screen.getByText('Pace stays steady')).toBeTruthy();
  });
});

describe('fields', () => {
  it('TextField reports changes and shows an error', async () => {
    const onChange = jest.fn();
    await render(<TextField label="Weight" value="" onChange={onChange} error="Enter a number" />);
    await fireEvent.changeText(screen.getByLabelText('Weight'), '62');
    expect(onChange).toHaveBeenCalledWith('62');
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('OtpField strips non-digits and caps length', async () => {
    const onChange = jest.fn();
    await render(<OtpField value="" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('One-time code input'), '12a34567');
    expect(onChange).toHaveBeenCalledWith('123456');
  });
  it('SearchField clears', async () => {
    const onChange = jest.fn();
    await render(<SearchField value="dal" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
  it('SliderField is adjustable', async () => {
    const onChange = jest.fn();
    await render(<SliderField label="Days a week" min={3} max={7} value={4} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: '6' }));
    expect(onChange).toHaveBeenCalledWith(6);
    expect(screen.getByRole('adjustable', { name: 'Days a week' })).toBeTruthy();
  });
});

describe('progress and data display', () => {
  it('ProgressBar exposes value', async () => {
    await render(<ProgressBar value={50} label="Plan" />);
    expect(screen.getByRole('progressbar', { name: 'Plan' })).toBeTruthy();
  });
  it('ProgressRing exposes label and clamps now', async () => {
    await render(<ProgressRing value={9000} max={6000} a11yLabel="Steps" />);
    expect(screen.getByLabelText('Steps').props.accessibilityValue.now).toBe(6000);
  });
  it('SegmentedProgress, SessionSegmentBar, WeekBars, WeekDots, Heatmap label themselves', async () => {
    await render(
      <>
        <SegmentedProgress label="Shape" segments={[{ weight: 2, state: 'done' }, { weight: 11, state: 'current', fill: 0.4 }, { weight: 2, state: 'todo' }]} />
        <SessionSegmentBar />
        <WeekBars values={[1, 2, 3, 4, 5, 6, 7]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} goal={4} />
        <WeekDots days={[{ label: 'M', done: true }, { label: 'T', done: false }]} />
        <Heatmap cells={[0, 1, 2, 3]} summary="Active 3 days" />
      </>,
    );
    expect(screen.getByLabelText('2 minutes warm-up, 11 minutes work, 2 minutes cool-down')).toBeTruthy();
    expect(screen.getByLabelText('M, done')).toBeTruthy();
    expect(screen.getByLabelText('Active 3 days')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Shape' }).props.accessibilityValue.now).toBe(1);
  });
});

describe('surfaces', () => {
  it('ListRow presses and builds a label', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Privacy" subtitle="Consent" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy, Consent' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('StatTile reads as one sentence', async () => {
    await render(<StatTile value={12} suffix="/ 20" label="Brisk minutes" />);
    expect(screen.getByLabelText('12 / 20, Brisk minutes')).toBeTruthy();
  });
  it('StatusBanner announces errors as alerts, not info', async () => {
    await render(
      <>
        <StatusBanner variant="error">Code expired</StatusBanner>
        <StatusBanner variant="info">Auto-reading</StatusBanner>
      </>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
  it('small displays render', async () => {
    await render(
      <>
        <Badge label="Your plan is ready" />
        <VerdictChip verdict="false" topic="Spot reduction" />
        <ChecklistItem state="done" label="Plan built" />
        <CreditBadge remaining={1} />
        <BenefitRow icon="verified" title="Unlimited checks" />
        <EmptyState icon="flag" title="Nothing yet" body="Finish a session." />
        <BigTimer seconds={75} caption="Hold" />
      </>,
    );
    expect(screen.getByLabelText('False, Spot reduction')).toBeTruthy();
    expect(screen.getByLabelText('1 of 2 free form checks left')).toBeTruthy();
    expect(screen.getByText('1:15')).toBeTruthy();
  });
  it('PaywallPlanCard is a radio', async () => {
    const onSelect = jest.fn();
    await render(<PaywallPlanCard title="Yearly" price="Rs 999" selected={false} onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Yearly, Rs 999' }));
    expect(onSelect).toHaveBeenCalled();
  });
  it('Accordion exposes expanded state', async () => {
    const onToggle = jest.fn();
    await render(<Accordion question="Why?" answer="Because." expanded onToggle={onToggle} />);
    expect(screen.getByText('Because.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Why?', expanded: true }));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe('overlays', () => {
  it('BottomSheet shows content only when visible and dismisses', async () => {
    const onDismiss = jest.fn();
    const { rerender } = await render(
      <BottomSheet visible={false} title="Sound" onDismiss={onDismiss}>
        <FilledButton label="Done" />
      </BottomSheet>,
    );
    expect(screen.queryByText('Sound')).toBeNull();
    await rerender(
      <BottomSheet visible title="Sound" onDismiss={onDismiss}>
        <FilledButton label="Done" />
      </BottomSheet>,
    );
    expect(screen.getByText('Sound')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
  it('ConfirmDialog runs the chosen action', async () => {
    const keep = jest.fn();
    const del = jest.fn();
    await render(
      <ConfirmDialog
        visible
        icon="delete_forever"
        title="Delete your account?"
        body="Gone for good."
        actions={[{ label: 'Keep my account', onPress: keep }, { label: 'Delete everything', variant: 'destructive', onPress: del }]}
      />,
    );
    expect(screen.getByRole('header', { name: 'Delete your account?' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete everything' }));
    expect(del).toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });
});
