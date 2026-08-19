import { buildEvolutionFamilies } from '../lib/evolutions';
import type { Pokemon } from '../lib/types';

function mon(num: number, evolvesFromNum: number | null = null): Pokemon {
  return {
    num, name_fr: `mon-${num}`, name_en: `mon-${num}`,
    types: ['normal'], sprite_url: '', evolvesFromNum,
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
