import { dexStateFor, computeDexProgress } from '../lib/dex-progress';
import type { Pokemon } from '../lib/types';

const sample: Pokemon[] = [
  { num: 1, name_fr: 'Bulbizarre', name_en: 'Bulbasaur', types: ['grass', 'poison'], sprite_url: '', evolvesFromNum: null },
  { num: 4, name_fr: 'Salamèche', name_en: 'Charmander', types: ['fire'], sprite_url: '', evolvesFromNum: null },
  { num: 7, name_fr: 'Carapuce', name_en: 'Squirtle', types: ['water'], sprite_url: '', evolvesFromNum: null },
  { num: 25, name_fr: 'Pikachu', name_en: 'Pikachu', types: ['electric'], sprite_url: '', evolvesFromNum: null },
];

describe('dexStateFor', () => {
  it('returns chosen when in the chosen set, regardless of the others', () => {
    expect(dexStateFor(1, new Set([1]), new Set([1]), new Set([1]))).toBe('chosen');
  });

  it('returns captured when in the captured set but not chosen', () => {
    expect(dexStateFor(1, new Set(), new Set([1]), new Set([1]))).toBe('captured');
  });

  it('prefers captured over seen when both apply', () => {
    expect(dexStateFor(1, new Set(), new Set([1]), new Set([1]))).toBe('captured');
  });

  it('returns seen when only wishlisted', () => {
    expect(dexStateFor(1, new Set(), new Set(), new Set([1]))).toBe('seen');
  });

  it('returns remaining when in none of the sets', () => {
    expect(dexStateFor(1, new Set(), new Set(), new Set())).toBe('remaining');
  });
});

describe('computeDexProgress', () => {
  it('buckets every entry into exactly one state', () => {
    const chosen = new Set([1]);
    const captured = new Set([1, 4]); // 1 also chosen — should count as chosen, not captured
    const wished = new Set([7]);
    const result = computeDexProgress(sample, chosen, captured, wished);
    expect(result).toEqual({ chosen: 1, captured: 1, seen: 1, remaining: 1 });
  });

  it('returns all-remaining for empty sets', () => {
    const result = computeDexProgress(sample, new Set(), new Set(), new Set());
    expect(result).toEqual({ chosen: 0, captured: 0, seen: 0, remaining: 4 });
  });
});
