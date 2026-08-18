import type { Locale } from './locale';

export interface Generation {
  gen: number;
  label: string;
  /** Same as `label` except for gen 5 ("Unys" is the FR region name; "Unova" in EN). */
  labelEn: string;
  min: number;
  max: number;
}

export const GENERATIONS: Generation[] = [
  { gen: 1, label: 'Gen 1 · Kanto',  labelEn: 'Gen 1 · Kanto',  min: 1,   max: 151  },
  { gen: 2, label: 'Gen 2 · Johto',  labelEn: 'Gen 2 · Johto',  min: 152, max: 251  },
  { gen: 3, label: 'Gen 3 · Hoenn',  labelEn: 'Gen 3 · Hoenn',  min: 252, max: 386  },
  { gen: 4, label: 'Gen 4 · Sinnoh', labelEn: 'Gen 4 · Sinnoh', min: 387, max: 493  },
  { gen: 5, label: 'Gen 5 · Unys',   labelEn: 'Gen 5 · Unova',  min: 494, max: 649  },
  { gen: 6, label: 'Gen 6 · Kalos',  labelEn: 'Gen 6 · Kalos',  min: 650, max: 721  },
  { gen: 7, label: 'Gen 7 · Alola',  labelEn: 'Gen 7 · Alola',  min: 722, max: 809  },
  { gen: 8, label: 'Gen 8 · Galar',  labelEn: 'Gen 8 · Galar',  min: 810, max: 905  },
  { gen: 9, label: 'Gen 9 · Paldea', labelEn: 'Gen 9 · Paldea', min: 906, max: 1025 },
];

export function getGeneration(dexNum: number): number {
  for (const g of GENERATIONS) if (dexNum >= g.min && dexNum <= g.max) return g.gen;
  return 0;
}

export function getGenerationLabel(g: Generation, locale: Locale): string {
  return locale === 'en' ? g.labelEn : g.label;
}

export const GEN_EMOJI: Record<number, string> = {
  1: '🌾', 2: '🌸', 3: '🌋', 4: '🏔️', 5: '⚡', 6: '🍇', 7: '🌺', 8: '❄️', 9: '🫒',
};

// The three starter dex numbers per generation (grass/fire/water order),
// shown as a mini sprite cluster in the Pokedex grid's generation headers
// instead of a single emoji.
export const GEN_STARTERS: Record<number, [number, number, number]> = {
  1: [1, 4, 7],       // Bulbasaur, Charmander, Squirtle
  2: [152, 155, 158], // Chikorita, Cyndaquil, Totodile
  3: [252, 255, 258], // Treecko, Torchic, Mudkip
  4: [387, 390, 393], // Turtwig, Chimchar, Piplup
  5: [495, 498, 501], // Snivy, Tepig, Oshawott
  6: [650, 653, 656], // Chespin, Fennekin, Froakie
  7: [722, 725, 728], // Rowlet, Litten, Popplio
  8: [810, 813, 816], // Grookey, Scorbunny, Sobble
  9: [906, 909, 912], // Sprigatito, Fuecoco, Quaxly
};

// One accent color per region, themed to its emoji (wheat field, cherry blossom, volcano...).
export const GEN_COLORS: Record<number, string> = {
  1: '#84cc16', 2: '#f472b6', 3: '#f97316', 4: '#38bdf8', 5: '#facc15',
  6: '#a855f7', 7: '#fb7185', 8: '#60a5fa', 9: '#65a30d',
};
