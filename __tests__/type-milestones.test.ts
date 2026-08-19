import { checkTypeMilestones, TYPE_MILESTONES } from '../lib/type-milestones';
import type { Pokemon } from '../lib/types';

function mon(overrides: Partial<Pokemon> & { num: number }): Pokemon {
  return {
    name_fr: `mon-${overrides.num}`, name_en: `mon-${overrides.num}`,
    types: ['normal'], sprite_url: '', evolvesFromNum: null,
    ...overrides,
  };
}

describe('checkTypeMilestones', () => {
  it('returns empty when the just-captured dex number is not in the pokedex', () => {
    const pokedex = [mon({ num: 1, types: ['grass'] })];
    expect(checkTypeMilestones(pokedex, 999, new Set([1]))).toEqual([]);
  });

  it('fires a milestone when the current owned count for a type hits a threshold', () => {
    const pokedex = Array.from({ length: 2 }, (_, i) => mon({ num: i + 1, types: ['fire'] }));
    const owned = new Set([1, 2]); // exactly 2 fire-types owned — 2 is the first milestone
    const result = checkTypeMilestones(pokedex, 2, owned);
    expect(result).toEqual([{ type: 'fire', count: 2 }]);
  });

  it('does not fire when the current count is not one of the milestone thresholds', () => {
    const pokedex = Array.from({ length: 3 }, (_, i) => mon({ num: i + 1, types: ['water'] }));
    const owned = new Set([1, 2, 3]); // 3 is not in TYPE_MILESTONES
    expect(checkTypeMilestones(pokedex, 3, owned)).toEqual([]);
  });

  it('fires on both types at once for a dual-type Pokémon when both hit a threshold', () => {
    const pokedex = [
      ...Array.from({ length: 2 }, (_, i) => mon({ num: i + 1, types: ['grass', 'poison'] })),
    ];
    const owned = new Set([1, 2]);
    const result = checkTypeMilestones(pokedex, 2, owned);
    expect(result).toEqual(expect.arrayContaining([
      { type: 'grass', count: 2 }, { type: 'poison', count: 2 },
    ]));
    expect(result).toHaveLength(2);
  });

  it('fires only for the type that crossed a threshold when the other did not', () => {
    const grassMons = Array.from({ length: 2 }, (_, i) => mon({ num: i + 1, types: ['grass'] }));
    const dual = mon({ num: 3, types: ['grass', 'poison'] }); // 3rd grass, 1st poison
    const pokedex = [...grassMons, dual];
    const owned = new Set([1, 2, 3]);
    const result = checkTypeMilestones(pokedex, 3, owned);
    expect(result).toEqual([]); // grass count=3 (not a milestone), poison count=1 (not a milestone)
  });

  it('every configured threshold is reachable', () => {
    expect(TYPE_MILESTONES).toEqual([2, 5, 10, 15, 20, 30, 40, 50]);
  });
});
