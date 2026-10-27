import { fireEvent, render, screen } from '@testing-library/react-native';
import { UIGallery } from '../Gallery';

describe('UIGallery', () => {
  it('renders in light and toggles to dark', async () => {
    await render(<UIGallery />);
    expect(screen.getByText('UI gallery')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Workout', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Toggle dark mode' }));
    expect(screen.getByText('UI gallery')).toBeTruthy();
  });
  it('opens the sheet', async () => {
    await render(<UIGallery />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByText('Sound')).toBeTruthy();
  });
  it('opens the dialog', async () => {
    await render(<UIGallery />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
  });
});
