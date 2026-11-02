// Store disclosure links shown on the Paywall. Set the real pages with EXPO_PUBLIC_TERMS_URL and
// EXPO_PUBLIC_PRIVACY_URL; the defaults are the planned addresses on the support domain.

export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://casafit.app/terms';
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || 'https://casafit.app/privacy';
