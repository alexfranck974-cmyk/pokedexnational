import type { Pokemon } from './types';

// Four mutually-exclusive states a Pokémon can be in from the National Dex's
// point of view — priority order matters (a Pokémon owned AND wishlisted
// counts as owned, not "seen"; a Pokémon with a chosen card always outranks
// merely being captured).
export type DexState = 'chosen' | 'captured' | 'seen' | 'remaining';

export function dexStateFor(dexNum: number, chosenSet: Set<number>, capturedSet: Set<number>, wishedSet: Set<number>): DexState {
  if (chosenSet.has(dexNum)) return 'chosen';
  if (capturedSet.has(dexNum)) return 'captured';
  if (wishedSet.has(dexNum)) return 'seen';
  return 'remaining';
}

export interface DexProgressBreakdown {
  chosen: number;
  captured: number;
  seen: number;
  remaining: number;
}

export function computeDexProgress(
  pokedex: Pokemon[],
  chosenSet: Set<number>,
  capturedSet: Set<number>,
  wishedSet: Set<number>,
): DexProgressBreakdown {
  const result: DexProgressBreakdown = { chosen: 0, captured: 0, seen: 0, remaining: 0 };
  for (const p of pokedex) {
    result[dexStateFor(p.num, chosenSet, capturedSet, wishedSet)]++;
  }
  return result;
}
