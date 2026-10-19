// Minimal typed fetch wrapper. One place to add auth headers, OTel traces,
// retries and the "network unreachable" error type used by the offline screen.

import Constants from 'expo-constants';
import { useAuth } from '@/state/auth';

const baseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3000';

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
  } catch {
    throw new NetworkError();
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
