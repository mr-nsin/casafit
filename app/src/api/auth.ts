import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@casafit/shared';

import { useAuth } from '@/state/auth';
import { getPurchases } from '@/services/purchases';
import { api } from './client';

/**
 * GET /v1/me. The first authenticated request creates the account on the server, so this is also what
 * "finishes" a sign-in. The summary and entitlements are cached in the auth store.
 */
export async function fetchMe(): Promise<MeResponse> {
  const me = await api<MeResponse>('/me');
  await useAuth.getState().applyMe(me);
  // Link store purchases to this account so Pro follows it to a new phone. Best effort: it never
  // blocks sign-in, and an unconfigured or offline store simply skips it.
  void getPurchases()
    .logIn(me.id)
    .catch(() => undefined);
  return me;
}

export function useMe(enabled = true) {
  return useQuery<MeResponse, Error>({ queryKey: ['me'], queryFn: fetchMe, enabled });
}
