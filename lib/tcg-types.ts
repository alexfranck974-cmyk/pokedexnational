import type { PokemonType } from './types';

// The Pokémon TCG has its own energy-type vocabulary — smaller than, and named
// differently from, the video game's 18 types (e.g. no separate line for every
// video-game type; Normal/Flying/Bug/Rock/Ground/Ice/Poison/Ghost Pokémon all
// print as "Colorless"). Mapped to a PokemonType only where a genuine 1:1
// equivalent exists, purely to reuse the existing TypeIcon glyph/TYPE_COLORS —
// "Colorless" has no video-game equivalent and falls back to a neutral treatment.
const TCG_TYPE_TO_POKEMON_TYPE: Record<string, PokemonType | undefined> = {
  Grass: 'grass', Fire: 'fire', Water: 'water', Lightning: 'electric',
  Psychic: 'psychic', Fighting: 'fighting', Darkness: 'dark', Metal: 'steel',
  Fairy: 'fairy', Dragon: 'dragon',
};

const TCG_TYPE_LABEL_FR: Record<string, string> = {
  Grass: 'Plante', Fire: 'Feu', Water: 'Eau', Lightning: 'Électrik',
  Psychic: 'Psy', Fighting: 'Combat', Darkness: 'Obscurité', Metal: 'Métal',
  Fairy: 'Fée', Dragon: 'Dragon', Colorless: 'Incolore',
};

export function tcgTypeLabelFr(tcgType: string): string {
  return TCG_TYPE_LABEL_FR[tcgType] ?? tcgType;
}

export function tcgTypeAsPokemonType(tcgType: string): PokemonType | undefined {
  return TCG_TYPE_TO_POKEMON_TYPE[tcgType];
}
