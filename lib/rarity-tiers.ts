export type RarityTier = 'basic' | 'holo' | 'chase';

// Shared chase-tier accent — the "secret rare" gold used by CaptureEffect and
// FriendCardReveal's particle burst/glow. Kept fixed regardless of the user's
// palette choice (see lib/theme.tsx) since it's semantic ("this pull is
// special"), not thematic.
export const CHASE_GOLD = '#fbbf24';

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

// "Le set de base" per the user: an extension's cards minus its illustration-rare
// alt-art reprints — used to decide what counts toward a type-line completion.
const ILLUSTRATION_RARE_TIER = new Set(['Illustration Rare', 'Special Illustration Rare']);

export function isIllustrationRareTier(rarity: string | null): boolean {
  return !!rarity && ILLUSTRATION_RARE_TIER.has(rarity);
}
