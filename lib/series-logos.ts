// Wordmark logos for global TCG eras ("Scarlet & Violet", "Mega Evolution"...),
// keyed by the exact `series` string pokemontcg.io gives us (see tcg_cards.series,
// 056_tcg_sets_series.sql). pokemontcg.io itself has no series-level art — only
// per-set images.logo/symbol — but TCGdex's /v2/{locale}/series endpoint does
// (verified 2026-08-30: 15/17 distinct global series values match a TCGdex id by
// name, the same reuse-first-set-as-era-logo pattern Pokémon's own branding uses).
// Hotlinked directly like the rest of our TCGdex-sourced art (public CDN, no API
// key, unlike PokeWallet's set-logo backfill which had to re-host — see
// sync-pokewallet-jp-logos.ts). "NP" and "Other" (grab-bag/promo sets with no real
// era identity) intentionally have no entry — callers fall back to text-only.
export const SERIES_LOGOS: Record<string, string> = {
  'Base': 'https://assets.tcgdex.net/en/base/base1/logo.webp',
  'Gym': 'https://assets.tcgdex.net/en/gym/gym1/logo.webp',
  'Neo': 'https://assets.tcgdex.net/en/neo/neo1/logo.webp',
  'E-Card': 'https://assets.tcgdex.net/en/ecard/ecard1/logo.webp',
  'EX': 'https://assets.tcgdex.net/en/ex/ex1/logo.webp',
  'POP': 'https://assets.tcgdex.net/en/pop/pop1/logo.webp',
  'Diamond & Pearl': 'https://assets.tcgdex.net/en/dp/dp1/logo.webp',
  'Platinum': 'https://assets.tcgdex.net/en/pl/pl1/logo.webp',
  'HeartGold & SoulSilver': 'https://assets.tcgdex.net/en/hgss/hgss1/logo.webp',
  'Black & White': 'https://assets.tcgdex.net/en/bw/bw1/logo.webp',
  'XY': 'https://assets.tcgdex.net/en/xy/xy1/logo.webp',
  'Sun & Moon': 'https://assets.tcgdex.net/en/sm/sm1/logo.webp',
  'Sword & Shield': 'https://assets.tcgdex.net/en/swsh/swsh1/logo.webp',
  'Scarlet & Violet': 'https://assets.tcgdex.net/en/sv/sv01/logo.webp',
  'Mega Evolution': 'https://assets.tcgdex.net/en/me/me01/logo.webp',
};

export function getSeriesLogo(series: string | null | undefined): string | undefined {
  return series ? SERIES_LOGOS[series] : undefined;
}
