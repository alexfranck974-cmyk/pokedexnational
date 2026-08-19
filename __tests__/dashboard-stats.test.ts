import {
  computeOverallProgress, computeByGeneration, computeByType, bucketVariantCards, computeVariantProgress,
  totalCollectionValue, computeSetGoalsProgress, averageProgress, topArtists,
  type VariantCard, type Progress,
} from '../lib/dashboard-stats';
import type { Pokemon } from '../lib/types';
import type { SetGoal } from '../lib/collection-goals';
import type { TcgSetInfo } from '../lib/tcg-index';

const sample: Pokemon[] = [
  { num: 1, name_fr: 'Bulbizarre', name_en: 'Bulbasaur', types: ['grass', 'poison'], sprite_url: '', evolvesFromNum: null },
  { num: 4, name_fr: 'Salamèche', name_en: 'Charmander', types: ['fire'], sprite_url: '', evolvesFromNum: null },
  { num: 152, name_fr: 'Germignon', name_en: 'Chikorita', types: ['grass'], sprite_url: '', evolvesFromNum: null }, // gen 2
];

describe('computeOverallProgress', () => {
  it('computes owned/total/pct', () => {
    expect(computeOverallProgress(sample, new Set([1, 4]))).toEqual({ owned: 2, total: 3, pct: 67 });
  });
  it('returns 0% for an empty pokedex', () => {
    expect(computeOverallProgress([], new Set())).toEqual({ owned: 0, total: 0, pct: 0 });
  });
});

describe('computeByGeneration', () => {
  it('buckets Pokémon into their generation and computes per-gen progress', () => {
    const result = computeByGeneration(sample, new Set([1]));
    const gen1 = result.find(g => g.gen === 1)!;
    const gen2 = result.find(g => g.gen === 2)!;
    expect(gen1).toMatchObject({ owned: 1, total: 2 });
    expect(gen2).toMatchObject({ owned: 0, total: 1 });
  });
});

describe('computeByType', () => {
  it('counts bi-type Pokémon toward both types', () => {
    const result = computeByType(sample, new Set([1]));
    const grass = result.find(t => t.type === 'grass')!;
    const poison = result.find(t => t.type === 'poison')!;
    expect(grass).toMatchObject({ owned: 1, total: 2 }); // Bulbasaur + Chikorita
    expect(poison).toMatchObject({ owned: 1, total: 1 }); // Bulbasaur only
  });

  it('sorts results alphabetically by type', () => {
    const result = computeByType(sample, new Set());
    const types = result.map(t => t.type);
    expect(types).toEqual([...types].sort());
  });
});

describe('bucketVariantCards', () => {
  const card = (name: string): VariantCard => ({ id: name, name, dex_num: 1, imageSmall: '', imageLarge: null });

  it('matches modern and vintage Mega card names', () => {
    const buckets = bucketVariantCards([card('Mega Charizard EX'), card('M Charizard-EX')]);
    expect(buckets.mega.map(c => c.id)).toEqual(['Mega Charizard EX', 'M Charizard-EX']);
  });

  it('does not false-positive on names that merely contain "mega"', () => {
    const buckets = bucketVariantCards([card('Yanmega'), card('Meganium')]);
    expect(buckets.mega).toEqual([]);
  });

  it('matches only the 5 official Rotom appliance formes, not other Rotom prints', () => {
    const buckets = bucketVariantCards([card('Fan Rotom'), card('Heat Rotom'), card('Rotom Dex'), card('Rotom ex'), card('Drone Rotom')]);
    expect(buckets.rotom.map(c => c.id)).toEqual(['Fan Rotom', 'Heat Rotom']);
  });

  it('matches Deoxys combat formes but not the plain default appearance', () => {
    const buckets = bucketVariantCards([card('Deoxys Defense Forme'), card('Deoxys Normal Forme'), card('Deoxys'), card('Deoxys-EX')]);
    expect(buckets.deoxys.map(c => c.id)).toEqual(['Deoxys Defense Forme', 'Deoxys Normal Forme']);
  });

  it('matches VMAX cards as gigamax', () => {
    const buckets = bucketVariantCards([card('Charizard VMAX'), card('Charizard V')]);
    expect(buckets.gigamax.map(c => c.id)).toEqual(['Charizard VMAX']);
  });

  it('matches regional forme keywords', () => {
    const buckets = bucketVariantCards([card('Alolan Ninetales'), card('Galarian Slowking'), card('Hisuian Zoroark'), card('Paldean Wooper')]);
    expect(buckets.alolan.map(c => c.id)).toEqual(['Alolan Ninetales']);
    expect(buckets.galarian.map(c => c.id)).toEqual(['Galarian Slowking']);
    expect(buckets.hisuian.map(c => c.id)).toEqual(['Hisuian Zoroark']);
    expect(buckets.paldean.map(c => c.id)).toEqual(['Paldean Wooper']);
  });

  it('a card can land in more than one bucket at once', () => {
    // Contrived, but exercises that buckets aren't mutually exclusive (no early return).
    const buckets = bucketVariantCards([card('Mega Alolan Test')]);
    expect(buckets.mega.map(c => c.id)).toEqual(['Mega Alolan Test']);
    expect(buckets.alolan.map(c => c.id)).toEqual(['Mega Alolan Test']);
  });
});

describe('computeVariantProgress', () => {
  it('computes owned/total per category from the bucketed cards', () => {
    const buckets = bucketVariantCards([
      { id: 'a', name: 'Mega Charizard EX', dex_num: 6, imageSmall: '', imageLarge: null },
      { id: 'b', name: 'Mega Blastoise EX', dex_num: 9, imageSmall: '', imageLarge: null },
    ]);
    const result = computeVariantProgress(buckets, new Set(['a']));
    expect(result.mega).toEqual({ owned: 1, total: 2, pct: 50 });
    expect(result.rotom).toEqual({ owned: 0, total: 0, pct: 0 });
  });
});

describe('totalCollectionValue', () => {
  it('weights each card by its owned quantity', () => {
    const ledger = [
      { cardId: 'a', cardmarketTrendEur: 10 },
      { cardId: 'b', cardmarketTrendEur: 5 },
    ];
    const quantities = new Map([['a', 3]]);
    // a: 10 * 3 = 30, b: 5 * 1 (default when not in quantities map) = 5
    expect(totalCollectionValue(ledger, quantities)).toBe(35);
  });

  it('treats a null price as 0', () => {
    const ledger = [{ cardId: 'a', cardmarketTrendEur: null }];
    expect(totalCollectionValue(ledger, new Map())).toBe(0);
  });
});

describe('computeSetGoalsProgress', () => {
  const allSets: TcgSetInfo[] = [
    { id: 'base1', name: 'Base', releaseDate: '1999-01-09', cardCount: 102, symbol: null, logo: null, region: 'global' },
  ];

  it('computes progress from the ledger and skips goals whose set is unknown', () => {
    const goals: SetGoal[] = [{ setId: 'base1', pinnedAt: '' }, { setId: 'missing-set', pinnedAt: '' }];
    const ledger = [{ setId: 'base1' }, { setId: 'base1' }, { setId: 'other' }];
    const result = computeSetGoalsProgress(goals, ledger, allSets);
    expect(result).toEqual([{ setId: 'base1', setName: 'Base', symbol: null, owned: 2, total: 102, pct: 2 }]);
  });
});

describe('averageProgress', () => {
  it('averages pct across items, ignoring zero-total ones', () => {
    const items: Progress[] = [{ owned: 5, total: 10, pct: 50 }, { owned: 0, total: 0, pct: 0 }, { owned: 10, total: 10, pct: 100 }];
    expect(averageProgress(items)).toBe(75);
  });

  it('returns 0 when every item has a zero total', () => {
    expect(averageProgress([{ owned: 0, total: 0, pct: 0 }])).toBe(0);
  });
});

describe('topArtists', () => {
  it('counts, sorts descending, and limits', () => {
    const owned = [
      { artist: 'Ken Sugimori' }, { artist: 'Ken Sugimori' }, { artist: 'Mitsuhiro Arita' }, { artist: null },
    ] as any[];
    expect(topArtists(owned, 1)).toEqual([{ artist: 'Ken Sugimori', count: 2 }]);
  });

  it('skips cards with no artist', () => {
    const owned = [{ artist: null }] as any[];
    expect(topArtists(owned, 10)).toEqual([]);
  });
});
