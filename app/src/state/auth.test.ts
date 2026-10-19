import { normaliseEmail, normalisePhoneE164 } from '@casafit/shared';

describe('identifier normalisation', () => {
  it('normalises Indian 10-digit phones to E.164', () => {
    expect(normalisePhoneE164('9876543210')).toBe('+919876543210');
  });

  it('keeps E.164 phones as they are', () => {
    expect(normalisePhoneE164('+14155551234')).toBe('+14155551234');
  });

  it('strips Gmail dots and plus-tags', () => {
    expect(normaliseEmail('P.R.I.Y.A+promo@gmail.com')).toBe('priya@gmail.com');
  });

  it('keeps non-Gmail dots', () => {
    expect(normaliseEmail('a.b+promo@example.com')).toBe('a.b@example.com');
  });

  it('rejects disposable domains', () => {
    expect(() => normaliseEmail('x@mailinator.com')).toThrow();
  });
});
