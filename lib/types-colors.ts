import type { PokemonType } from './types';
import type { Locale } from './locale';

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

export const TYPE_LABEL_FR: Record<PokemonType, string> = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik',
  grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
  ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
  steel: 'Acier', fairy: 'Fée',
};

export const TYPE_LABEL_EN: Record<PokemonType, string> = {
  normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric',
  grass: 'Grass', ice: 'Ice', fighting: 'Fighting', poison: 'Poison',
  ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
  rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark',
  steel: 'Steel', fairy: 'Fairy',
};

export function getTypeLabel(type: PokemonType, locale: Locale): string {
  return locale === 'en' ? TYPE_LABEL_EN[type] : TYPE_LABEL_FR[type];
}
