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

// Walks evolvesFromNum back to the family's root, then evolvesToNums forward
// stage by stage — handles both linear chains (Charmander -> Charmeleon ->
// Charizard) and branching ones (Eevee -> its 8 Eeveelutions) the same way,
// regardless of which member of the family `pokemon` itself is. Each stage is
// an array since branches place several Pokémon at the same depth.
export function buildEvolutionStages(pokemon: Pokemon, byDex: Map<number, Pokemon>): Pokemon[][] {
  let root = pokemon;
  const rootGuard = new Set([root.num]);
  while (root.evolvesFromNum != null) {
    const prev = byDex.get(root.evolvesFromNum);
    if (!prev || rootGuard.has(prev.num)) break;
    root = prev;
    rootGuard.add(root.num);
  }

  const stages: Pokemon[][] = [[root]];
  const seen = new Set([root.num]);
  let current = [root];
  while (current.length > 0) {
    const next: Pokemon[] = [];
    for (const mon of current) {
      for (const childNum of mon.evolvesToNums) {
        const child = byDex.get(childNum);
        if (child && !seen.has(child.num)) {
          next.push(child);
          seen.add(child.num);
        }
      }
    }
    if (next.length === 0) break;
    stages.push(next);
    current = next;
  }
  return stages;
}
