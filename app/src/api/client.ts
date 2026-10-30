// Minimal typed fetch wrapper. One place to add auth headers, OTel traces,
// retries and the "network unreachable" error type used by the offline screen.

import Constants from 'expo-constants';
import { getAuth } from '@/services/auth';
import { useAuth } from '@/state/auth';

// Local API (api/docker-compose.yml) by default. Android emulators reach it through `adb reverse tcp:5080 tcp:5080`.
const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:5080';

export class NetworkError extends Error {
  constructor() {
    super('Network unavailable');
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
    this.name = 'ApiError';
  }
}

async function send(path: string, init: RequestInit | undefined, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    return await fetch(`${baseUrl}/v1${path}`, { ...init, headers });
  } catch (e) {
    if (__DEV__) console.warn(`[api] ${path} failed against ${baseUrl}:`, String(e));
    throw new NetworkError();
  }
}

/**
 * The token comes from the sign-in provider, which refreshes it before it expires. If the API still answers 401 we
 * try one forced refresh and repeat the request once. If the refresh is rejected (or the second try is also 401)
 * the person is signed out kindly: Welcome explains, nothing on the phone is deleted.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const token = await auth.getAccessToken().catch(() => null);
  let res = await send(path, init, token);
  if (res.status === 401 && token) {
    const r = await auth.refresh().catch(() => ({ ok: false, reason: 'offline' }) as const);
    if (r.ok) {
      res = await send(path, init, await auth.getAccessToken().catch(() => null));
      if (res.status === 401) await useAuth.getState().endSession();
    } else if (r.reason !== 'offline') {
      await useAuth.getState().endSession();
    }
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
