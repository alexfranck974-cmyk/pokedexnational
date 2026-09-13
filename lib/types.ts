export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface Pokemon {
  num: number;
  name_fr: string | null;
  name_en: string;
  types: PokemonType[];
  sprite_url: string;
  evolvesFromNum: number | null;
  evolvesToNums: number[];
  stats: PokemonStats;
  description_fr: string | null;
  description_en: string | null;
}
