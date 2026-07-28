import type { Pokemon, PokemonType } from './types';
import type { TcgCardRow } from './tcg';
import { isIllustrationRareTier } from './rarity-tiers';

// Groups the unique dex numbers present in a set by Pokémon type — a Pokémon with
// several types counts toward each of them, mirroring dashboard-stats' computeByType.
// Illustration-rare printings are alt-art reprints of a Pokémon already in the
// "base set" (the user's term) and don't establish a type-line requirement on
// their own — a dex number with only an illustration-rare printing in this set
// isn't required at all, matching "toutes les cartes qui ne sont pas illustration
// rare, d'un même type".
export function buildSetTypeGroups(cards: TcgCardRow[], pokedexByDex: Map<number, Pokemon>): Map<PokemonType, number[]> {
  const groups = new Map<PokemonType, Set<number>>();
  const seen = new Set<number>();
  for (const c of cards) {
    if (c.dex_num == null || seen.has(c.dex_num) || isIllustrationRareTier(c.rarity)) continue;
    seen.add(c.dex_num);
    const mon = pokedexByDex.get(c.dex_num);
    if (!mon) continue;
    for (const t of mon.types) {
      if (!groups.has(t)) groups.set(t, new Set());
      groups.get(t)!.add(c.dex_num);
    }
  }
  const result = new Map<PokemonType, number[]>();
  for (const [t, dexNums] of groups) result.set(t, Array.from(dexNums));
  return result;
}

// A dex number counts as owned within the set if any of its NON-illustration-rare
// cards in this set (e.g. a regular reprint) is in the given owned-card-id set —
// owning only the illustration-rare alt-art doesn't satisfy the requirement.
function isDexOwnedIn(owned: Set<string>, dexNum: number, cards: TcgCardRow[]): boolean {
  return cards.some(c => c.dex_num === dexNum && !isIllustrationRareTier(c.rarity) && owned.has(c.id));
}

// Returns the types that flip from incomplete to fully-owned-in-this-set as a
// result of marking `toggledCard` as owned — empty if none do, or if the type
// was already fully owned before this toggle (e.g. via another reprint).
export function typesCompletedByToggle(
  toggledCard: TcgCardRow,
  cards: TcgCardRow[],
  pokedexByDex: Map<number, Pokemon>,
  ownedCardIdsBeforeToggle: Set<string>,
  typeGroups: Map<PokemonType, number[]>,
): PokemonType[] {
  if (toggledCard.dex_num == null) return [];
  const mon = pokedexByDex.get(toggledCard.dex_num);
  if (!mon) return [];
  const ownedAfter = new Set(ownedCardIdsBeforeToggle);
  ownedAfter.add(toggledCard.id);

  const completed: PokemonType[] = [];
  for (const t of mon.types) {
    const group = typeGroups.get(t);
    if (!group || group.length === 0) continue;
    const wasComplete = group.every(dex => isDexOwnedIn(ownedCardIdsBeforeToggle, dex, cards));
    if (wasComplete) continue;
    const isCompleteNow = group.every(dex => isDexOwnedIn(ownedAfter, dex, cards));
    if (isCompleteNow) completed.push(t);
  }
  return completed;
}
