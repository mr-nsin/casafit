// Minimal typed fetch wrapper. One place to add auth headers, OTel traces,
// retries and the "network unreachable" error type used by the offline screen.

import Constants from 'expo-constants';
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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().session?.accessToken;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1${path}`, { ...init, headers });
  } catch (e) {
    if (__DEV__) console.warn(`[api] ${path} failed against ${baseUrl}:`, String(e));
    throw new NetworkError();
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
