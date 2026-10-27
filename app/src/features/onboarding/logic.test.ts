import { bundledContent } from '../../content';
import { buildPlan } from '../../engine';
import { onboardingRoutes } from './index';
import { contentToCatalogue } from './catalogue';
import { draftToPlanInput } from './buildAndSave';
import { emptyDraft } from '../../state/onboardingDraft';
import {
  birthYearOptions, canContinueAge, defaultMix, healthIntro, maskIdentifier, nextAfterAbout, nextAfterMix, parseHeight, parseWeight,
} from './logic';
import { rootRouteLanes } from '../../app/routes';

describe('logic', () => {
  it('age gate', () => {
    expect(canContinueAge({ birthYear: 2000, confirmed18: true }, 2026)).toBe(true);
    expect(canContinueAge({ birthYear: 2010, confirmed18: true }, 2026)).toBe(false);
    expect(canContinueAge({ birthYear: 2000, confirmed18: false }, 2026)).toBe(false);
    expect(birthYearOptions(2026)[0]).toBe(2025);
  });
  it('step order (D4)', () => {
    expect(nextAfterAbout({ styles: ['normal'], healthFlags: [] })).toBe('Building');
    expect(nextAfterAbout({ styles: ['normal'], healthFlags: ['heart_bp'] })).toBe('Health');
    expect(nextAfterAbout({ styles: ['normal', 'yoga', 'dance'], healthFlags: ['heart_bp'] })).toBe('Mix');
    expect(nextAfterMix({ healthFlags: [] })).toBe('Building');
  });
  it('mix defaults to the day total', () => {
    expect(defaultMix(['normal', 'dance', 'yoga'], 5)).toEqual({ normal: 2, dance: 2, yoga: 1 });
  });
  it('optional measurements', () => {
    expect(parseHeight('')).toEqual({ value: null });
    expect(parseHeight('500').error).toBeTruthy();
    expect(parseWeight('62.5')).toEqual({ value: 62.5 });
  });
  it('masks identifiers and words the health intro', () => {
    expect(maskIdentifier('phone', '+919876543210')).toBe('+91 98*** **210');
    expect(maskIdentifier('email', 'priya@x.com')).toBe('p***@x.com');
    expect(healthIntro(['heart_bp', 'recent_surgery'])).toContain('your heart or blood pressure and your recent surgery');
  });
});

describe('content catalogue adapter and engine', () => {
  const catalogue = contentToCatalogue(bundledContent.exercises.exercises);
  it('drops micro-only moves and keeps ids unique', () => {
    expect(new Set(catalogue.exercises.map((e) => e.id)).size).toBe(catalogue.exercises.length);
    expect(catalogue.exercises.some((e) => e.id === 'neck_release')).toBe(false);
  });
  it.each([
    ['stay_fit', ['normal'], []],
    ['body_part', ['normal'], ['knees']],
  ] as const)('builds a seven-day week for %s %j %j', (goal, styles, pain) => {
    const d = { ...emptyDraft(), goal, styles: [...styles], bodyParts: goal === 'body_part' ? ['core'] : [], painAreas: [...pain] as never, experience: 'on_and_off' as const };
    const plan = buildPlan(draftToPlanInput(d, '2026-10-27', 2026, 7), catalogue);
    expect(plan.days).toHaveLength(7);
    expect(plan.days.filter((x) => x.session).length).toBe(4);
  });
});

describe('route registry', () => {
  it('registers exactly the onboarding lane routes, each a real screen', () => {
    const lane = Object.entries(rootRouteLanes).filter(([, l]) => l === 'onboarding').map(([k]) => k).sort();
    expect(Object.keys(onboardingRoutes).sort()).toEqual(lane);
    Object.values(onboardingRoutes).forEach((r) => expect(typeof r.component).toBe('function'));
  });
});
