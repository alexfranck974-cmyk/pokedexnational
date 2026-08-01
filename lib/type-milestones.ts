import type { Pokemon, PokemonType } from './types';

// Thresholds for the "N Pokémon de type X capturés" celebration — extendable,
// the higher ones exist mostly for types with more members (Water, Normal...).
export const TYPE_MILESTONES = [2, 5, 10, 15, 20, 30, 40, 50];

export interface TypeMilestone { type: PokemonType; count: number; }

// Called right after a single new dex_num was added to the National Dex
// (user_dex, via useToggleCard) — since exactly one entry just changed,
// "the current owned count for this type is a milestone value" is equivalent
// to "we just crossed it," so no before/after diff needs to be tracked.
// A dual-type Pokémon can trigger up to two milestones at once (queued
// together by the caller, same pattern as CaptureEffect's existing queue).
export function checkTypeMilestones(pokedex: Pokemon[], capturedDex: number, updatedOwned: Set<number>): TypeMilestone[] {
  const captured = pokedex.find(p => p.num === capturedDex);
  if (!captured) return [];
  const results: TypeMilestone[] = [];
  for (const type of captured.types) {
    const count = pokedex.filter(p => p.types.includes(type) && updatedOwned.has(p.num)).length;
    if (TYPE_MILESTONES.includes(count)) results.push({ type, count });
  }
  return results;
}
