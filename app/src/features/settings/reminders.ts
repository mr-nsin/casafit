// Turns saved reminder preferences into scheduled local notifications.

import { getNotificationService } from '../../services/notifications';
import { usePreferences } from '../../state/preferences';
import { getRepositories, hasRepositories } from '../../state/storage';

export const REMINDER_BODY = '15 minutes, and you can edit it first.';

/** Re-schedules (or cancels) from the stored preferences. Safe to call after a plan or time change. */
export async function applyReminders(workoutTitle: string | null): Promise<void> {
  const svc = getNotificationService();
  const { enabled, time, sundayRecap } = usePreferences.getState().notifications;
  if (!enabled) {
    await svc.cancelAll();
    return;
  }
  await svc.schedule({
    time,
    sundayRecap,
    weekday: { title: `${workoutTitle ?? 'Your workout'} is ready`, body: REMINDER_BODY },
    recap: { title: 'Your week in one card', body: 'See how your week went. No pressure.' },
  });
}

/**
 * Re-reads the first workout day of the saved plan and re-schedules, so the reminder text follows
 * the plan. Does nothing when reminders are off or no database is open. Never throws.
 */
export async function refreshReminders(): Promise<void> {
  if (!usePreferences.getState().notifications.enabled || !hasRepositories()) return;
  try {
    const repos = getRepositories();
    const plan = await repos.plan.get();
    const days = plan ? await repos.plan.days(plan.weekNumber) : [];
    await applyReminders(days.find((d) => d.kind === 'workout')?.title ?? null);
  } catch {
    /* the old reminder stays */
  }
}
