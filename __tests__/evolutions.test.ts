import { buildEvolutionFamilies, buildEvolutionStages } from '../lib/evolutions';
import type { Pokemon } from '../lib/types';

function mon(num: number, evolvesFromNum: number | null = null, evolvesToNums: number[] = []): Pokemon {
  return {
    num, name_fr: `mon-${num}`, name_en: `mon-${num}`,
    types: ['normal'], sprite_url: '', evolvesFromNum, evolvesToNums,
    stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    description_fr: null, description_en: null,
  };
}

describe('buildEvolutionFamilies', () => {
  it('groups a Pokémon with no relatives into its own single-member family', () => {
    const pokedex = [mon(1)];
    expect(buildEvolutionFamilies(pokedex)).toEqual([{ members: [1] }]);
  });

  it('groups a simple three-stage chain into one family', () => {
    const pokedex = [mon(1), mon(2, 1), mon(3, 2)];
    const families = buildEvolutionFamilies(pokedex);
    expect(families).toHaveLength(1);
    expect(families[0].members).toEqual([1, 2, 3]);
  });

  it('groups a branching family (one base, several evolutions) into one family', () => {
    // Eevee-like: 1 base, 133/134/135 all evolve directly from it.
    const pokedex = [mon(1), mon(135, 1), mon(133, 1), mon(134, 1)];
    const families = buildEvolutionFamilies(pokedex);
    expect(families).toHaveLength(1);
    expect(families[0].members).toEqual([1, 133, 134, 135]); // sorted ascending
  });

  it('keeps unrelated Pokémon in separate families', () => {
    const pokedex = [mon(1), mon(2, 1), mon(10), mon(11, 10)];
    const families = buildEvolutionFamilies(pokedex).map(f => f.members).sort((a, b) => a[0] - b[0]);
    expect(families).toEqual([[1, 2], [10, 11]]);
  });

  it('treats a dangling evolvesFromNum (predecessor not in the pokedex) as having no predecessor', () => {
    const pokedex = [mon(50, 999)]; // 999 doesn't exist in this pokedex slice
    expect(buildEvolutionFamilies(pokedex)).toEqual([{ members: [50] }]);
  });
});

describe('buildEvolutionStages', () => {
  it('returns a single stage for a Pokémon with no relatives', () => {
    const solo = mon(1);
    const byDex = new Map([[1, solo]]);
    expect(buildEvolutionStages(solo, byDex).map(s => s.map(m => m.num))).toEqual([[1]]);
  });

  it('builds a linear chain regardless of which member is queried', () => {
    const a = mon(1, null, [2]);
    const b = mon(2, 1, [3]);
    const c = mon(3, 2, []);
    const byDex = new Map([[1, a], [2, b], [3, c]]);
    const expected = [[1], [2], [3]];
    expect(buildEvolutionStages(a, byDex).map(s => s.map(m => m.num))).toEqual(expected);
    expect(buildEvolutionStages(b, byDex).map(s => s.map(m => m.num))).toEqual(expected);
    expect(buildEvolutionStages(c, byDex).map(s => s.map(m => m.num))).toEqual(expected);
  });

  it('groups a branching family (Eevee-like) into one stage per depth', () => {
    const base = mon(1, null, [2, 3, 4]);
    const evoA = mon(2, 1, []);
    const evoB = mon(3, 1, []);
    const evoC = mon(4, 1, []);
    const byDex = new Map([[1, base], [2, evoA], [3, evoB], [4, evoC]]);
    expect(buildEvolutionStages(evoB, byDex).map(s => s.map(m => m.num))).toEqual([[1], [2, 3, 4]]);
  });

  it('ignores a dangling evolvesFromNum/evolvesToNums entry not present in byDex', () => {
    const solo = mon(50, 999, [51]); // neither 999 nor 51 resolve
    const byDex = new Map([[50, solo]]);
    expect(buildEvolutionStages(solo, byDex).map(s => s.map(m => m.num))).toEqual([[50]]);
  });
});
