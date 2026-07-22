import type { Pokemon } from './types';
import { getName } from './i18n';
import type { EvolutionFamily } from './evolutions';
import type { GenerationProgress } from './dashboard-stats';
import { GENERATIONS } from './generations';

export interface Suggestion {
  num: number;
  name: string;
  spriteUrl: string;
  reason: string;
}

// One suggestion per incomplete family (the first missing member in dex order),
// rather than every missing member — otherwise one big incomplete line would crowd
// out every other family.
export function suggestEvolutionGaps(
  pokedex: Pokemon[], owned: Set<number>, families: EvolutionFamily[], limit = 8,
): Suggestion[] {
  const byNum = new Map(pokedex.map(p => [p.num, p]));
  const suggestions: Suggestion[] = [];
  for (const family of families) {
    if (family.members.length < 2) continue;
    const ownedMembers = family.members.filter(n => owned.has(n));
    const missingMembers = family.members.filter(n => !owned.has(n));
    if (ownedMembers.length === 0 || missingMembers.length === 0) continue;
    const mon = byNum.get(missingMembers[0]);
    const ownedRef = byNum.get(ownedMembers[0]);
    if (!mon) continue;
    suggestions.push({
      num: mon.num,
      name: getName(mon),
      spriteUrl: mon.sprite_url,
      reason: ownedRef ? `Tu as ${getName(ownedRef)}` : 'Complète la ligne évolutive',
    });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

// Chunks the national dex into fixed-size "binder pages" (default 16 = a 4x4 quad-row
// page) and surfaces the missing cards on pages that are closest to complete.
export function suggestBinderPages(
  pokedex: Pokemon[], owned: Set<number>, pageSize = 16, limit = 8,
): Suggestion[] {
  const byNum = new Map(pokedex.map(p => [p.num, p]));
  const totalPages = Math.ceil(1025 / pageSize);
  const pages: { pageIndex: number; missing: number[]; ownedCount: number }[] = [];

  for (let page = 0; page < totalPages; page++) {
    const start = page * pageSize + 1;
    const end = Math.min(start + pageSize - 1, 1025);
    const nums: number[] = [];
    for (let n = start; n <= end; n++) if (byNum.has(n)) nums.push(n);
    const ownedCount = nums.filter(n => owned.has(n)).length;
    const missing = nums.filter(n => !owned.has(n));
    if (ownedCount > 0 && missing.length > 0) pages.push({ pageIndex: page, missing, ownedCount });
  }

  pages.sort((a, b) => a.missing.length - b.missing.length);

  const suggestions: Suggestion[] = [];
  for (const page of pages) {
    for (const num of page.missing) {
      const mon = byNum.get(num);
      if (!mon) continue;
      suggestions.push({
        num: mon.num,
        name: getName(mon),
        spriteUrl: mon.sprite_url,
        reason: `Page ${page.pageIndex + 1} presque complète (${page.ownedCount}/${page.ownedCount + page.missing.length})`,
      });
      if (suggestions.length >= limit) return suggestions;
    }
  }
  return suggestions;
}

// Missing Pokémon from whichever generation currently has the lowest completion %.
export function suggestByGeneration(
  byGeneration: GenerationProgress[], pokedex: Pokemon[], owned: Set<number>, limit = 8,
): Suggestion[] {
  const eligible = byGeneration.filter(g => g.total > 0 && g.owned < g.total);
  if (eligible.length === 0) return [];
  const worst = eligible.reduce((a, b) => (a.pct <= b.pct ? a : b));
  const gen = GENERATIONS.find(g => g.gen === worst.gen);
  if (!gen) return [];
  return pokedex
    .filter(p => p.num >= gen.min && p.num <= gen.max && !owned.has(p.num))
    .slice(0, limit)
    .map(mon => ({
      num: mon.num,
      name: getName(mon),
      spriteUrl: mon.sprite_url,
      reason: `${worst.label} : ${worst.pct}% complété`,
    }));
}
