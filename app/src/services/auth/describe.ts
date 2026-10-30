import type { AuthProvider as ProviderName } from '@casafit/shared';

const NAME: Record<ProviderName, string> = { email: 'email', google: 'Google', apple: 'Apple', facebook: 'Facebook' };

/** "Signed in with Google as n***@gmail.com", or just "Signed in as n***@gmail.com" for an email code. */
export function describeSignIn(provider: ProviderName | null | undefined, masked: string | null | undefined): string {
  const via = provider && provider !== 'email' ? ` with ${NAME[provider]}` : '';
  return masked ? `Signed in${via} as ${masked}` : `Signed in${via}`;
}
