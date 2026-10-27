import type {
  Catalogue,
  Exercise,
  HealthFlag,
  PainArea,
  Restrictions,
} from './types';

export interface CatalogueIndex {
  all: Exercise[];
  byId: Map<string, Exercise>;
  /** Exercises of each ladder, easiest first. */
  byLadder: Map<string, Exercise[]>;
}

export function indexCatalogue(catalogue: Catalogue): CatalogueIndex {
  const byId = new Map<string, Exercise>();
  const byLadder = new Map<string, Exercise[]>();
  for (const ex of catalogue.exercises) {
    byId.set(ex.id, ex);
    const list = byLadder.get(ex.ladder);
    if (list) list.push(ex);
    else byLadder.set(ex.ladder, [ex]);
  }
  for (const list of byLadder.values()) {
    list.sort((a, b) => a.level - b.level || (a.id < b.id ? -1 : 1));
  }
  return { all: catalogue.exercises.slice(), byId, byLadder };
}

export function familyOf(ex: Exercise): string {
  return ex.family ?? ex.ladder;
}

/**
 * Health flags route to the gentler plan (PRD section 6). Pain areas only remove moves.
 * "Other" pain is not a body area the catalogue can match, so it removes nothing by itself.
 */
export function restrictionsFor(input: {
  painAreas: readonly PainArea[];
  healthFlags: readonly HealthFlag[];
  quiet?: boolean;
}): Restrictions {
  return {
    painAreas: input.painAreas,
    healthFlags: input.healthFlags,
    gentler: input.healthFlags.length > 0,
    quiet: input.quiet ?? false,
  };
}

export type ExclusionReason = PainArea | HealthFlag | 'gentler' | 'quiet';

/** Why a move is out for this user, or null when it is allowed. */
export function exclusionReason(ex: Exercise, r: Restrictions): ExclusionReason | null {
  for (const c of ex.contraindications) {
    if ((r.painAreas as readonly string[]).includes(c)) return c;
    if ((r.healthFlags as readonly string[]).includes(c)) return c;
  }
  if (r.gentler && (ex.hiit || ex.jumping || ex.impact === 'high')) return 'gentler';
  if (r.quiet && (ex.jumping || ex.impact === 'high')) return 'quiet';
  return null;
}

export function isEligible(ex: Exercise, r: Restrictions): boolean {
  return exclusionReason(ex, r) === null;
}

/**
 * Picks the move on a ladder closest to `targetLevel` that this user may do.
 * Ties go to the easier rung. Returns null when nothing on the ladder is allowed.
 */
export function resolveLadder(
  index: CatalogueIndex,
  ladderId: string,
  targetLevel: number,
  r: Restrictions,
): Exercise | null {
  const list = index.byLadder.get(ladderId);
  if (!list) return null;
  let best: Exercise | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const ex of list) {
    if (!isEligible(ex, r)) continue;
    const dist = Math.abs(ex.level - targetLevel);
    if (dist < bestDist) {
      best = ex;
      bestDist = dist;
    }
  }
  return best;
}

export function highestLevel(index: CatalogueIndex, ladderId: string): number {
  const list = index.byLadder.get(ladderId);
  const last = list?.[list.length - 1];
  return last ? last.level : 0;
}

/** Excluded moves, one per family, for the "skipped because of your knee" line. */
export function skippedMoves(
  index: CatalogueIndex,
  r: Restrictions,
  styles: readonly string[],
): { exerciseId: string; name: string; reason: ExclusionReason }[] {
  // A family is "skipped" only when no move in it is allowed for this user.
  const families = new Map<string, Exercise[]>();
  for (const ex of index.all) {
    if (ex.phase !== 'work' || !styles.includes(ex.style)) continue;
    const fam = familyOf(ex);
    const list = families.get(fam);
    if (list) list.push(ex);
    else families.set(fam, [ex]);
  }
  const out: { exerciseId: string; name: string; reason: ExclusionReason }[] = [];
  for (const list of families.values()) {
    if (list.some((ex) => isEligible(ex, r))) continue;
    const first = list[0];
    if (!first) continue;
    const reason = exclusionReason(first, r);
    // Quiet mode is a session switch, not an answer, so it is not reported as a skip.
    if (!reason || reason === 'quiet') continue;
    out.push({ exerciseId: first.id, name: first.name, reason });
  }
  return out;
}
