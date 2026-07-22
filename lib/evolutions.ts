import type { Pokemon } from './types';

export interface EvolutionFamily {
  members: number[];
}

// Groups Pokémon into connected evolutionary lines via evolvesFromNum. A Pokémon with
// no predecessor and nothing evolving from it is its own single-member family.
export function buildEvolutionFamilies(pokedex: Pokemon[]): EvolutionFamily[] {
  const byNum = new Map(pokedex.map(p => [p.num, p]));
  const parent = new Map<number, number>();
  const find = (n: number): number => {
    let root = n;
    while (parent.has(root)) root = parent.get(root)!;
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const p of pokedex) {
    if (p.evolvesFromNum !== null && byNum.has(p.evolvesFromNum)) {
      union(p.num, p.evolvesFromNum);
    }
  }

  const groups = new Map<number, number[]>();
  for (const p of pokedex) {
    const root = find(p.num);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(p.num);
  }
  return Array.from(groups.values()).map(members => ({ members: members.sort((a, b) => a - b) }));
}
