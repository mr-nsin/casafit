import { fireEvent, render, screen } from '@testing-library/react-native';

import { loadContent } from '../../content';
import { ConceptsScreen, LearnScreen, MythScreen } from './LearnScreens';
import { ctaTarget, longDate, nextOf, reviewInfo, sortedMyths } from './model';
import { learnRoutes } from '.';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

beforeEach(() => Object.values(mockNav).forEach((f) => f.mockClear()));

const content = loadContent();

describe('review status is honest', () => {
  it('every bundled card is waiting for review and says so', () => {
    for (const c of [...content.myths, ...content.concepts]) {
      const info = reviewInfo(c);
      expect(info.reviewed).toBe(false);
      expect(info.line).toMatch(/Waiting for expert review/);
    }
  });
  it('a reviewed card shows its date; pending sources are marked', () => {
    const info = reviewInfo({ reviewStatus: 'reviewed', reviewedOn: '2026-10-16', sources: [{ label: 'A', status: 'found' }, { label: 'B', status: 'pending' }] });
    expect(info.reviewed).toBe(true);
    expect(info.line).toBe('Last reviewed 16 October 2026');
    expect(info.sources).toEqual(['Source: A', 'Source: B (to be confirmed)']);
    expect(info.sourcesPending).toBe(true);
  });
  it('a reviewed status without a date is not claimed as reviewed', () => {
    expect(reviewInfo({ reviewStatus: 'reviewed', reviewedOn: null, sources: [] }).reviewed).toBe(false);
  });
  it('formats dates', () => {
    expect(longDate('2026-01-05')).toBe('5 January 2026');
  });
});

describe('cta routing', () => {
  it('maps content routes onto real routes', () => {
    expect(ctaTarget({ labelKey: 'x', route: 'Home' })).toEqual({ name: 'Main' });
    expect(ctaTarget({ labelKey: 'x', route: 'Concepts', params: { id: 'warm_up' } })).toEqual({ name: 'Concepts', params: { conceptId: 'warm_up' } });
    expect(ctaTarget({ labelKey: 'x', route: 'BodyPart', params: { part: 'core' } })).toEqual({ name: 'BodyPart', params: { part: 'core' } });
  });
  it('every bundled cta targets a known route', () => {
    const known = new Set(['Main', 'Concepts', 'BodyPart', 'Library', 'Steps', 'Reverse']);
    for (const m of content.myths) expect(known.has(ctaTarget(m.cta).name)).toBe(true);
  });
  it('next myth stops at the end of the list', () => {
    const list = sortedMyths(content.myths);
    expect(nextOf(list, list[0]!.id)?.id).toBe(list[1]!.id);
    expect(nextOf(list, list[list.length - 1]!.id)).toBeNull();
  });
});

describe('Learn hub', () => {
  it('lists myths with verdict words, not just an icon, and opens one', async () => {
    await render(<LearnScreen />);
    expect(screen.getByText('Crunches burn belly fat')).toBeTruthy();
    expect(screen.getAllByText(/Partly true/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Review pending').length).toBe(content.myths.length);
    await fireEvent.press(screen.getByLabelText(/Myth: Crunches burn belly fat/));
    expect(mockNav.navigate).toHaveBeenCalledWith('Myth', { mythId: 'crunches_belly_fat' });
  });

  it('switches to concepts and opens a concept', async () => {
    await render(<LearnScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Concepts' }));
    expect(screen.getByText(/They work offline/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Why we warm up'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Concepts', { conceptId: 'warm_up' });
  });

  it('shows form tips from the cue pack, one cue per move', async () => {
    await render(<LearnScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Form tips' }));
    expect(screen.getByText(/One cue per move/)).toBeTruthy();
    const withCues = content.exercises.filter((e) => e.formCheckable && content.formCues(e.id).length > 0);
    expect(screen.getAllByLabelText(/\./).length).toBeGreaterThanOrEqual(Math.min(1, withCues.length));
  });

  it('the Concepts route opens on the Concepts tab', async () => {
    await render(<ConceptsScreen />);
    expect(screen.getByText('Why we warm up')).toBeTruthy();
  });
});

describe('Myth detail', () => {
  it('shows the verdict, truth, evidence, CTA and an honest review note', async () => {
    await render(<MythScreen route={{ params: { mythId: 'crunches_belly_fat' } }} />);
    expect(screen.getByLabelText('False')).toBeTruthy();
    expect(screen.getByText('Crunches burn belly fat')).toBeTruthy();
    expect(screen.getByText('What is true')).toBeTruthy();
    expect(screen.getByText(/to be confirmed/)).toBeTruthy();
    expect(screen.getByText(/Waiting for expert review/)).toBeTruthy();
    expect(screen.queryByText(/Last reviewed/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Try a core session/ }));
    expect(mockNav.navigate).toHaveBeenCalledWith('BodyPart', { part: 'core' });
  });

  it('Next myth moves to the next card, the last card goes back to Learn', async () => {
    const list = sortedMyths(content.myths);
    const { unmount } = await render(<MythScreen route={{ params: { mythId: list[0]!.id } }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next myth' }));
    expect(mockNav.replace).toHaveBeenCalledWith('Myth', { mythId: list[1]!.id });
    await unmount();
    await render(<MythScreen route={{ params: { mythId: list[list.length - 1]!.id } }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Learn' }));
    expect(mockNav.replace).toHaveBeenCalledWith('Learn');
  });

  it('an unknown id is handled without a crash', async () => {
    await render(<MythScreen route={{ params: { mythId: 'nope' } }} />);
    expect(screen.getByText('We could not find that myth')).toBeTruthy();
  });
});

describe('Concept detail', () => {
  it('shows the read, the key point and the review note', async () => {
    await render(<ConceptsScreen route={{ params: { conceptId: 'warm_up' } }} />);
    expect(screen.getByText('Why we warm up')).toBeTruthy();
    expect(screen.getByText(/Key point/)).toBeTruthy();
    expect(screen.getByText(/Waiting for expert review/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next concept' }));
    expect(mockNav.replace).toHaveBeenCalledWith('Concepts', { conceptId: expect.any(String) });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to concepts' }));
    expect(mockNav.replace).toHaveBeenCalledWith('Concepts');
  });
  it('registry exposes three routes', () => {
    expect(Object.keys(learnRoutes).sort()).toEqual(['Concepts', 'Learn', 'Myth']);
  });
});
