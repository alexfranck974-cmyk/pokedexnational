import type { Locale } from './locale';
import { getName } from './i18n';
import type { Pokemon } from './types';
import pokedexData from '@/data/pokedex.json';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

// TCGdex only ever returns a JP/CN card's own printed name in its native script
// (see scripts/sync-tcgdex-cards.ts) — unreadable to a non-JP/CN-literate user,
// unlike JP/CN *set* names which already get an English label via
// lib/tcg-set-labels.ts. Falls back to the species name from data/pokedex.json
// (same POKEDEX_BY_DEX + getName pattern as components/DexCardPanel.tsx),
// looked up by dex_num rather than attempting a text translation.
//
// Global (region 'global') cards are deliberately left untouched: their printed
// `name` (e.g. "Charizard ex") already carries meaningful info — the ex/VSTAR/GX
// variant — that swapping in the plain species name would throw away, and it's
// already readable. Same for Trainer/Energy cards (no dex_num) in any region.
// dexNum is a separate argument rather than a `card.dex_num` property — the app's
// TCG card types disagree on the field's casing (TcgCardRow's `dex_num` vs.
// collection.ts's ledger types' `dexNum`), and since it's nullable either way,
// mistakenly reading the wrong property name would silently no-op (falls back to
// `card.name`) instead of a type error. Forcing every call site to pass it
// explicitly makes that mismatch impossible.
export function cardDisplayName(
  card: { name: string; region?: 'global' | 'jp' | 'cn' | null },
  dexNum: number | null | undefined,
  locale: Locale,
): string {
  if ((card.region === 'jp' || card.region === 'cn') && dexNum != null) {
    const mon = POKEDEX_BY_DEX.get(dexNum);
    if (mon) return getName(mon, locale);
  }
  return card.name;
}
