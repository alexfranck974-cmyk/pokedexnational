import type { OwnedCardFinish } from './collection';
import { CHASE_GOLD } from './rarity-tiers';

// Same card image regardless of finish (pokemontcg.io doesn't provide separate
// art per finish) — so the finish is communicated purely through the tile's
// existing gradient border instead of a different picture. Holo gets a warm
// gold shimmer, reverse holo a cool silver one, both clearly distinct from the
// plain app-color border a "normal" owned card already has.
// No 'normal' entry — that case keeps using the caller's plain app-color
// gradient (or the gold dex-pick halo, which takes priority regardless of finish).
export const FINISH_GRADIENT: Partial<Record<OwnedCardFinish, [string, string, string]>> = {
  holo: [CHASE_GOLD, '#fff7cc', CHASE_GOLD],
  reverse_holo: ['#8fa3b3', '#ffffff', '#8fa3b3'],
};

// A card can be owned in more than one finish at once — pick the showiest one
// to represent it on a tile that only has room for one border. Holo first
// (rarer/flashier in the common case), then reverse holo, then normal.
export function pickPrimaryFinish(finishes: OwnedCardFinish[] | undefined): OwnedCardFinish | null {
  if (!finishes || finishes.length === 0) return null;
  if (finishes.includes('holo')) return 'holo';
  if (finishes.includes('reverse_holo')) return 'reverse_holo';
  return 'normal';
}
