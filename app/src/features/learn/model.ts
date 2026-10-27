// Learn cards: read-only bundled content, shown with their real review status.
// The pack marks every card needsExpertReview. A card is described as reviewed only when it
// has reviewStatus 'reviewed' AND a reviewedOn date; otherwise the screen says it is waiting
// for review and each source says whether it is confirmed.

import type { Concept, LearnSource, Myth, Verdict } from '../../content';

export type VerdictChipKind = 'false' | 'partly' | 'true';
export const chipVerdict = (v: Verdict): VerdictChipKind => (v === 'partly_true' ? 'partly' : v);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export interface ReviewInfo {
  reviewed: boolean;
  /** Short line for a card or footer. */
  line: string;
  sources: string[];
  /** True when any source is still to be confirmed. */
  sourcesPending: boolean;
}

export function reviewInfo(card: { reviewStatus: 'pending' | 'reviewed'; reviewedOn: string | null; sources: readonly LearnSource[] }): ReviewInfo {
  const reviewed = card.reviewStatus === 'reviewed' && !!card.reviewedOn;
  return {
    reviewed,
    line: reviewed ? `Last reviewed ${longDate(card.reviewedOn!)}` : 'Waiting for expert review. Treat this as general information.',
    sources: card.sources.map((s) => (s.status === 'found' ? `Source: ${s.label}` : `Source: ${s.label} (to be confirmed)`)),
    sourcesPending: card.sources.some((s) => s.status !== 'found'),
  };
}

export const sortedMyths = (m: readonly Myth[]): Myth[] => [...m].sort((a, b) => a.order - b.order);
export const sortedConcepts = (c: readonly Concept[]): Concept[] => [...c].sort((a, b) => a.order - b.order);

export function nextOf<T extends { id: string }>(list: readonly T[], id: string): T | null {
  const i = list.findIndex((x) => x.id === id);
  return i >= 0 && i < list.length - 1 ? list[i + 1]! : null;
}

/** Where a card's call to action goes. Content uses "Home" and `{ id }`; routes use Main and `conceptId`. */
export function ctaTarget(cta: Myth['cta']): { name: string; params?: Record<string, unknown> } {
  if (cta.route === 'Home') return { name: 'Main' };
  if (cta.route === 'Concepts') {
    const id = (cta.params as { id?: string; conceptId?: string } | undefined)?.id ?? (cta.params as { conceptId?: string } | undefined)?.conceptId;
    return id ? { name: 'Concepts', params: { conceptId: id } } : { name: 'Concepts' };
  }
  return { name: cta.route, params: cta.params };
}

export const MYTH_TONES = ['pc', 'tc', 'sc'] as const;
