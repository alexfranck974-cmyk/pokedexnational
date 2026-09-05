// English labels for Japanese/Chinese TCG set names, so "Filtrer par extension"
// is navigable without reading the native script (e.g. finding "Abyss Eye"
// instead of only ever seeing "アビスアイ").
//
// Keyed by set_id, NOT by the displayed native name. It used to be
// name-keyed, which silently broke for jp-SV3a and jp-SV4a: both are stored
// under the identical Japanese display name "レイジングサーフ" (a known
// TCGdex/data quirk — see sync-tcgplayer-images.ts's comment on jp-SV4a),
// but they're genuinely different real-world sets ("Raging Surf" vs "Shiny
// Treasure ex"). A name-keyed lookup can only ever return one answer for
// that shared text, so one of the two was always shown wrong. id-keying
// fixes this by construction: each set gets its own unambiguous entry
// regardless of what native text it happens to share with another set.
//
// Sourced from Bulbapedia's JP/CN TCG expansion lists and (for the 2026-09
// Mainland China batch) PikaQian's own English `name` field per set —
// verified 2026-07-31 (JP) and 2026-09 (JP batch 2 + CN). A handful of
// starter-deck/product-bundle releases aren't covered and are deliberately
// left untranslated below rather than guessed — extend these tables as more
// gaps are found, same pattern as EN_GAP_SET_IDS in the sync scripts.
export const JP_SET_NAME_EN: Record<string, string> = {
  'jp-M-P': 'Mega Promo Cards',
  'jp-M1L': 'Mega Brave',
  'jp-M1S': 'Mega Symphonia',
  'jp-M2': 'Inferno X',
  'jp-M2a': 'MEGA Dream ex',
  'jp-M3': 'Nihil Zero',
  'jp-M4': 'Ninja Spinner',
  'jp-M5': 'Abyss Eye',
  'jp-M6': 'Storm Emeralda',
  'jp-MC': 'Start Deck 100 Battle Collection',
  'jp-S9': 'Star Birth',
  'jp-S9a': 'Battle Region',
  'jp-S10P': 'Space Juggler',
  'jp-S10a': 'Dark Phantasma',
  'jp-S11': 'Lost Abyss',
  'jp-S11a': 'Incandescent Arcana',
  'jp-S12': 'Paradigm Trigger',
  'jp-S12a': 'VSTAR Universe',
  'jp-SV-P': 'Scarlet & Violet Promo Cards',
  'jp-SV1S': 'Scarlet ex',
  'jp-SV1V': 'Violet ex',
  'jp-SV1a': 'Triplet Beat',
  'jp-SV2D': 'Clay Burst',
  'jp-SV2P': 'Snow Hazard',
  'jp-SV2a': 'Pokémon Card 151',
  'jp-SV3': 'Ruler of the Black Flame',
  'jp-SV3a': 'Raging Surf',
  'jp-SV4K': 'Ancient Roar',
  'jp-SV4M': 'Future Flash',
  'jp-SV4a': 'Shiny Treasure ex',
  'jp-SV5K': 'Wild Force',
  'jp-SV5M': 'Cyber Judge',
  'jp-SV5a': 'Crimson Haze',
  'jp-SV6': 'Transformation Mask',
  'jp-SV6a': 'Night Wanderer',
  'jp-SV7': 'Stellar Miracle',
  'jp-SV7a': 'Paradise Dragona',
  'jp-SV8': 'Super Electric Breaker',
  'jp-SV8a': 'Terastal Fest ex',
  'jp-SV9': 'Battle Partners',
  'jp-SV9a': 'Hot Wind Arena',
  'jp-SV10': 'Glory of the Rocket Gang',
  'jp-SV11B': 'Black Bolt',
  'jp-SV11W': 'White Flare',
  'jp-SVK': 'Stellar Miracle Deck Build Box',
  'jp-SVLN': 'Sylveon ex Stellar Tera Type Starter Set',
  'jp-SVLS': 'Ceruledge ex Stellar Tera Type Starter Set',
};

// Taiwan (Traditional Chinese, our original `cn-*` sets) share the same
// underlying set-code releases as their JP counterparts above — same
// generation/content, just localized text — so these reuse the JP English
// names for the matching code. Verified: no set-code above is a genuine
// JP/TW content mismatch (unlike JP/Mainland China, which don't correspond
// 1:1 at all — see sync-pikaqian-cards.ts's header comment).
//
// Mainland China (Simplified Chinese, `cn-<pikaqian_id>`) entries are
// transcribed directly from PikaQian's own English `name` field per set —
// authoritative, not a translation guess.
export const CN_SET_NAME_EN: Record<string, string> = {
  'cn-CSMPiC': 'Battle Party Set: Reward Pack',
  'cn-SV7': 'Stellar Miracle',
  'cn-SV7a': 'Paradise Dragona',
  'cn-SV8': 'Super Electric Breaker',
  'cn-SV8a': 'Terastal Fest ex',
  'cn-SV9': 'Battle Partners',
  'cn-SV9a': 'Hot Wind Arena',
  'cn-SV10': 'Glory of the Rocket Gang',

  'cn-151c': 'Collect 151 Surprise, Hope, Journey, & Gathering',
  'cn-cbb1c': 'Gem Pack Vol 1',
  'cn-cbb2c': 'Gem Pack Vol 2',
  'cn-cbb3c': 'Gem Pack Vol 3',
  'cn-cbb4c': 'Gem Pack Vol 4',
  'cn-cbb5c': 'Gem Pack Vol 5',
  'cn-cbb6c': 'Gem Pack Volume 6',
  'cn-cs0lc': 'Pikachu & Eevee Card Display Pendant Gift Box',
  'cn-cs1.5c': 'Dynamax Tactics',
  'cn-cs1ac': 'Dynamax Clash - Set A',
  'cn-cs1bc': 'Dynamax Clash - Set B',
  'cn-cs1dc': 'Dynamax Clash V Starter Deck',
  'cn-cs2.1c': 'Meowth Little Tricks',
  'cn-cs2.5c': 'Brilliant Counterattack',
  'cn-cs2ac': 'Vivid Portrayals - Set A',
  'cn-cs2bc': 'Vivid Portrayals - Set B',
  'cn-cs2dac': 'Family Pokémon Trading Card Game',
  'cn-cs3.5c': 'Scorching Skies',
  'cn-cs3ac': 'Primordial Arts - Set A',
  'cn-cs3bc': 'Primordial Arts - Set B',
  'cn-cs3dc': 'Primordial Arts V Starter Deck',
  'cn-cs4.1c': 'Brilliant Energy Promo Pack 1',
  'cn-cs4.5c': 'Final Flame Dance',
  'cn-cs4ac': 'Nine Colors Gathering - Set A',
  'cn-cs4bc': 'Nine Colors Gathering - Set B',
  'cn-cs4dac': 'Start Deck 100',
  'cn-cs5.1c': 'Brilliant Energy Promo Pack 2',
  'cn-cs5.5c': 'Shadow of Glory',
  'cn-cs5ac': 'Brave Stars - Set A',
  'cn-cs5bc': 'Brave Stars - Set B',
  'cn-cs5dc': 'Brave Stars V Starter Deck',
  'cn-cs6.1c': 'Brilliant Energy Promo Pack 3',
  'cn-cs6.5c': 'Victory Star Guide',
  'cn-cs6ac': 'Shadow of the Blue Sea - Set A',
  'cn-cs6bc': 'Shadow of the Blue Sea - Set B',
  'cn-csac': 'Dynamax Clash Deck Building Box',
  'cn-csbc': 'Primordial Arts Overgrow Deck Building Box',
  'cn-cscc': 'Primordial Arts Torrent Deck Building Box',
  'cn-csdc': 'Poké Ball Gift Box: Legendary Pikachu Celebration',
  'cn-csec': 'Quadrilateral Connection Box Sets',
  'cn-csfc': 'Dragon Resurgence',
  'cn-csgc': 'Pokémon Card Display Sets',
  'cn-cshc': 'Eevee Advanced Gift Box',
  'cn-csic': 'Trainer Collection Gift Box',
  'cn-csjc': 'Poké Ball Gift Box: Art Illustration Celebration Scene',
  'cn-csm1.5c': 'Battle Elite',
  'cn-csm1ac': 'Storming Emergence - Set A',
  'cn-csm1bc': 'Storming Emergence - Set B',
  'cn-csm1cc': 'Storming Emergence - Set C',
  'cn-csm1dc': 'Storming Emergence GX Starter Deck',
  'cn-csm2.1c': 'Golden Energy',
  'cn-csm2.5c': 'Striking Competition',
  'cn-csm2ac': 'Shining Synergy - Set A',
  'cn-csm2bc': 'Shining Synergy - Set B',
  'cn-csm2cc': 'Shining Synergy - Set C',
  'cn-csm2dc': 'Shining Synergy GX Starter Deck',
  'cn-csmac': 'Arceus & Dialga & Palkia GX Premium Deck Building Box',
  'cn-csmc': 'Pokémon Card Display Sets Volume 2',
  'cn-csmjc': 'Shining Pokémon Poké Ball Box',
  'cn-csmlc': "Lillie's Support Box",
  'cn-csmpac': 'Battle Party Set Grass Deck',
  'cn-csmpbc': 'Battle Party Set Fire Deck',
  'cn-csmpcc': 'Battle Party Set Water Deck',
  'cn-csmpdc': 'Battle Party Set Lightning Deck',
  'cn-csmpec': 'Battle Party Set Psychic Deck',
  'cn-csmpfc': 'Battle Party Set Fighting Deck',
  'cn-csmpgc': 'Battle Party Set Darkness Deck',
  'cn-csmphc': 'Battle Party Set Metal Deck',
  'cn-csmpic': 'Battle Party Set Reward Pack',
  'cn-csmpjc': 'Grass Modification Pack',
  'cn-csmpkc': 'Fire Modification Pack',
  'cn-csmplc': 'Water Modification Pack',
  'cn-csmpmc': 'Lightning Modification Pack',
  'cn-csmpnc': 'Psychic Modification Pack',
  'cn-csmpoc': 'Fighting Modification Pack',
  'cn-csmppc': 'Darkness Modification Pack',
  'cn-csmpqc': 'Metal Modification Pack',
  'cn-csmyc': 'Eevee-GX Box Sets',
  'cn-csnc': 'Brave Stars Deck Building Gift Box',
  'cn-csoc': 'Mew Advanced Deck Building Gift Box',
  'cn-csuc': 'Pokémon Card Display Sets Volume 3',
  'cn-csv10c': 'Chasing Glory Together',
  'cn-csv1c': 'Eternal Birth',
  'cn-csv2c': 'Miracle Journey',
  'cn-csv3c': 'Fearless Terastal',
  'cn-csv4c': 'Bonus Round',
  'cn-csv5c': 'Dark Crystal Blaze',
  'cn-csv6c': 'Arcane Truth',
  'cn-csv7c': 'Blade Awakened',
  'cn-csv8c': 'Sparkling Fantasy',
  'cn-csv9.5c': 'Terastal Gathering',
  'cn-csv9c': 'Stellar Crystal',
  'cn-csve1c': 'Battle Party: Shared Dream',
  'cn-csve1pc': 'Battle Party: Shared Dream — King Reward Pack',
  'cn-csve2c': 'Battle Party: Shining Dream',
  'cn-csve2pc': 'Battle Party: Shining Dream — King Reward Pack',
  'cn-csvh1ac': 'Happy Set 1: Modification Pack',
  'cn-csvh1c': 'Happy Set 1: Pikachu & Clefairy & Turtwig & Gimmighoul',
  'cn-csvh1pc': 'Happy Set 1: Reward Pack',
  'cn-csvh2ac': 'Happy Set 2: Modification Pack',
  'cn-csvh2c': 'Happy Set 2: Lucario & Greninja & Zamazenta & Mabosstiff',
  'cn-csvh2pc': 'Happy Set 2: Reward Pack',
  'cn-csvh3ac': 'Happy Set 3: Modification Pack',
  'cn-csvh3c': 'Happy Set 3: Altaria & Latios & Infernape & Maushold',
  'cn-csvh3pc': 'Happy Set 3: Reward Pack',
  'cn-csvh4ac': 'Happy Set 4: Modification Pack',
  'cn-csvh4c': 'Happy Set 4: Decidueye & Melmetal & Koraidon & Miraidon',
  'cn-csvh4ec': 'Happy Set 4: Happy Pack',
  'cn-csvh4pc': 'Happy Set 4: Reward Pack',
  'cn-csvh5ac': 'Happy Set 5: Modification Pack',
  'cn-csvh5c': 'Happy Set 5: Dragonite & Mewtwo & Camerupt & Sinistcha',
  'cn-csvh5ec': 'Happy Set 5: Happy Pack',
  'cn-csvh5pc': 'Happy Set 5: Reward Pack',
  'cn-csvl1c': 'Departure Special Pack',
  'cn-csvl2c': 'Travel Theme Pack',
  'cn-csvm1ac': 'Master Strategy Deck Building Set: Charizard ex',
  'cn-csvm1bc': 'Master Strategy Deck Building Set: Gardevoir ex',
  'cn-csvm1cc': 'Master Strategy Deck Building Set: Miraidon ex',
  'cn-csvm2ac': 'Master Strategy Deck Building Set: Raging Bolt ex',
  'cn-csvm2bc': 'Master Strategy Deck Building Set: Dragapult ex',
  'cn-csvm2cc': 'Master Strategy Deck Building Set: Gholdengo ex',
  'cn-csvnc': 'Kitakami Theme Pack',
  'cn-csvsc': 'Battle Academy',
  'cn-csxc': 'Giratina VSTAR Advanced Deck Building Gift Box',
  'cn-csyc': 'Poké Ball Gift Box: Art Illustration Celebration Gathering',
  'cn-cszc': 'Variety Treasure Box Collection',
  'cn-promo-30th-p': '30th Anniversary Promos',
  'cn-promo-s-p': 'Sword & Shield Promos',
  'cn-promo-sm-p': 'Sun & Moon Promos',
  'cn-promo-sv-p': 'Scarlet & Violet Promos',
};

export function setDisplayName(setName: string, setId: string): string {
  const en = JP_SET_NAME_EN[setId] ?? CN_SET_NAME_EN[setId];
  return en ? `${en} · ${setName}` : setName;
}

const REGION_FLAG: Record<string, string> = { jp: '🇯🇵', cn: '🇨🇳' };

// Flag + English name for a JP/CN set — falls back to the native name when no
// translation exists yet (the tables above are curated and incomplete) so a
// gap never hides a set, it just shows untranslated with its flag.
export function setFlagLabel(setName: string, region: string | null | undefined, setId: string | null | undefined): string {
  const flag = region ? REGION_FLAG[region] : undefined;
  if (!flag) return setName;
  const en = setId ? (region === 'jp' ? JP_SET_NAME_EN[setId] : region === 'cn' ? CN_SET_NAME_EN[setId] : undefined) : undefined;
  return `${flag} ${en ?? setName}`;
}
