import { canonicalEmail, isValidEmail, maskEmail, normaliseEmail } from '@casafit/shared';

// Same vectors the api unit tests read (api/tests/CasaFit.UnitTests/Auth/SupabaseAuthTests.cs).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectors = require('../../../shared/fixtures/identifiers.json') as {
  email: { input: string; expected: string | null }[];
  normalise: { input: string; expected: string | null }[];
};

describe('email handling in shared/', () => {
  it.each(vectors.normalise)('normaliseEmail($input) -> $expected', ({ input, expected }) => {
    if (expected === null) expect(() => normaliseEmail(input)).toThrow();
    else expect(normaliseEmail(input)).toBe(expected);
  });

  it.each(vectors.email.filter((v) => v.expected !== null))('canonicalEmail($input) -> $expected', ({ input, expected }) => {
    expect(canonicalEmail(input)).toBe(expected);
  });

  it('keeps plus-tags and dots when normalising, because the code goes to what was typed', () => {
    expect(normaliseEmail('P.R.I.Y.A+x@Gmail.com')).toBe('p.r.i.y.a+x@gmail.com');
  });

  it('validates and masks', () => {
    expect(isValidEmail('asha@example.com')).toBe(true);
    expect(isValidEmail('asha@example')).toBe(false);
    expect(maskEmail('nitin@gmail.com')).toBe('n***@gmail.com');
  });
});
