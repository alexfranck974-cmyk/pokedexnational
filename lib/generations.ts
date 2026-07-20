export interface Generation {
  gen: number;
  label: string;
  min: number;
  max: number;
}

export const GENERATIONS: Generation[] = [
  { gen: 1, label: 'Gen 1 · Kanto',  min: 1,   max: 151  },
  { gen: 2, label: 'Gen 2 · Johto',  min: 152, max: 251  },
  { gen: 3, label: 'Gen 3 · Hoenn',  min: 252, max: 386  },
  { gen: 4, label: 'Gen 4 · Sinnoh', min: 387, max: 493  },
  { gen: 5, label: 'Gen 5 · Unys',   min: 494, max: 649  },
  { gen: 6, label: 'Gen 6 · Kalos',  min: 650, max: 721  },
  { gen: 7, label: 'Gen 7 · Alola',  min: 722, max: 809  },
  { gen: 8, label: 'Gen 8 · Galar',  min: 810, max: 905  },
  { gen: 9, label: 'Gen 9 · Paldea', min: 906, max: 1025 },
];

export function getGeneration(dexNum: number): number {
  for (const g of GENERATIONS) if (dexNum >= g.min && dexNum <= g.max) return g.gen;
  return 0;
}
