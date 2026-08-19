import { pickPrimaryFinish } from '../lib/finish-visuals';

describe('pickPrimaryFinish', () => {
  it('returns null for undefined or empty finishes', () => {
    expect(pickPrimaryFinish(undefined)).toBeNull();
    expect(pickPrimaryFinish([])).toBeNull();
  });

  it('returns the single finish when only one is owned', () => {
    expect(pickPrimaryFinish(['normal'])).toBe('normal');
    expect(pickPrimaryFinish(['holo'])).toBe('holo');
    expect(pickPrimaryFinish(['reverse_holo'])).toBe('reverse_holo');
  });

  it('prioritizes holo over reverse_holo and normal, regardless of array order', () => {
    expect(pickPrimaryFinish(['holo', 'reverse_holo'])).toBe('holo');
    expect(pickPrimaryFinish(['normal', 'holo'])).toBe('holo');
    expect(pickPrimaryFinish(['reverse_holo', 'normal', 'holo'])).toBe('holo');
  });

  it('prioritizes reverse_holo over normal when holo is absent', () => {
    expect(pickPrimaryFinish(['reverse_holo', 'normal'])).toBe('reverse_holo');
    expect(pickPrimaryFinish(['normal', 'reverse_holo'])).toBe('reverse_holo');
  });
});
