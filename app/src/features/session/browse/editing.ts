// Working copy of the session being edited. Editor and Picker share it through this store, so a
// move picked in the sheet shows up in the editor. Nothing is written to the plan until the user
// saves ("Save to my plan"); "Just today" starts the session from the copy and writes nothing.

import { create } from 'zustand';

import type { PlanDayRow, Repositories } from '../../../db/repositories';
import type { EditFailure, PlanStep, SessionPlan } from '../../../engine';

export interface EditDraft {
  /** 'week-day', the same key Plan uses. */
  key: string;
  week: number;
  dayIndex: number;
  session: SessionPlan;
  /** The session as it was saved when the editor opened. */
  baseline: SessionPlan;
}

interface DraftStore {
  draft: EditDraft | null;
  /** The last thing that happened ("Removed Dead bug."), shown above the list. */
  notice: string | null;
  setNotice(text: string | null): void;
  init(d: Omit<EditDraft, 'baseline'>): void;
  set(session: SessionPlan): void;
  clear(): void;
}

export const useEditDraft = create<DraftStore>((set) => ({
  draft: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
  init: (d) => set({ draft: { ...d, baseline: d.session }, notice: null }),
  set: (session) => set((s) => (s.draft ? { draft: { ...s.draft, session } } : s)),
  clear: () => set({ draft: null, notice: null }),
}));

export const isDirty = (d: EditDraft | null): boolean => !!d && JSON.stringify(d.session) !== JSON.stringify(d.baseline);

/** Seconds as m:ss. */
export function clock(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const r = s % 60;
  return `${Math.floor(s / 60)}:${r < 10 ? '0' : ''}${r}`;
}

export const EDIT_MESSAGES: Record<EditFailure, string> = {
  min_work: 'Keep at least 3 moves in a session.',
  max_work: '8 moves is the most for one session.',
  unknown_exercise: 'We could not find that move.',
  unknown_step: 'That move is no longer in the session.',
  excluded: 'That move does not suit your answers.',
  duplicate: 'That move is already in today\'s session.',
  not_work_move: 'Only work moves can be changed here.',
};

/** Moves a work step one place earlier (-1) or later (+1) among the work steps. */
export function moveWork(session: SessionPlan, stepId: string, delta: -1 | 1): SessionPlan {
  const work = session.steps.map((s, i) => ({ s, i })).filter((x) => x.s.phase === 'work');
  const at = work.findIndex((x) => x.s.id === stepId);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= work.length) return session;
  const steps = session.steps.slice();
  const a = work[at]!.i;
  const b = work[to]!.i;
  const tmp = steps[a] as PlanStep;
  steps[a] = steps[b] as PlanStep;
  steps[b] = tmp;
  return { ...session, steps };
}

/** Writes the edited session onto its plan day and marks the day as changed by the user. */
export async function persistSession(repos: Repositories, week: number, dayIndex: number, session: SessionPlan): Promise<void> {
  const rows = await repos.plan.days(week);
  const next: PlanDayRow[] = rows.map((r) =>
    r.dayIndex === dayIndex ? { ...r, kind: 'workout', title: session.title, style: session.style, sessionJson: JSON.stringify(session), overridden: true } : r,
  );
  await repos.plan.replaceDays(week, next);
}
