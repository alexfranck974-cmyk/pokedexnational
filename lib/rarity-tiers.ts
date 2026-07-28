export type RarityTier = 'basic' | 'holo' | 'chase';

// Rarity naming isn't strictly ordered across 30+ years of sets, so these tiers are a
// curated heuristic rather than a canonical ranking. Shared between the badge wall
// (lib/badges.ts) and the capture celebration effect (components/CaptureEffect.tsx).
const BASIC_RARITIES = new Set(['Common', 'Uncommon', 'Promo', 'Rare']);

const CHASE_RARITIES = new Set([
  'Rare Secret', 'Rare Rainbow', 'Rare Shining', 'Rare Shiny', 'Rare Shiny GX',
  'Shiny Rare', 'Shiny Ultra Rare', 'Ultra Rare', 'Hyper Rare', 'Mega Hyper Rare',
  'Special Illustration Rare', 'Illustration Rare', 'Amazing Rare', 'Radiant Rare',
  'Rare Prism Star', 'LEGEND',
]);

export function classifyRarity(rarity: string | null): RarityTier {
  if (!rarity) return 'basic';
  if (CHASE_RARITIES.has(rarity)) return 'chase';
  if (!BASIC_RARITIES.has(rarity)) return 'holo';
  return 'basic';
}
