import { isValidUsername } from '../lib/slug';

describe('isValidUsername', () => {
  it('accepts lowercase, digits, underscore, hyphen (3–30 chars)', () => {
    expect(isValidUsername('tristan')).toBe(true);
    expect(isValidUsername('tristan-123')).toBe(true);
    expect(isValidUsername('t_r_s_t')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
  });
  it('rejects too short / too long', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });
  it('rejects uppercase, spaces, dots', () => {
    expect(isValidUsername('Tristan')).toBe(false);
    expect(isValidUsername('tristan.dev')).toBe(false);
    expect(isValidUsername('tri stan')).toBe(false);
  });
  it('rejects leading hyphen or underscore', () => {
    expect(isValidUsername('-tristan')).toBe(false);
    expect(isValidUsername('_tristan')).toBe(false);
  });
});
