// Turns saved reminder preferences into scheduled local notifications.

import { getNotificationService } from '../../services/notifications';
import { usePreferences } from '../../state/preferences';

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
