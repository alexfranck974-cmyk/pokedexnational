import { applyPokedexPipeline } from '../lib/pokedex-list';
import type { Pokemon } from '../lib/types';

const sample: Pokemon[] = [
  { num: 1, name_fr: 'Bulbizarre', name_en: 'Bulbasaur', types: ['grass', 'poison'], sprite_url: '', evolvesFromNum: null },
  { num: 4, name_fr: 'Salamèche', name_en: 'Charmander', types: ['fire'], sprite_url: '', evolvesFromNum: null },
  { num: 7, name_fr: 'Carapuce', name_en: 'Squirtle', types: ['water'], sprite_url: '', evolvesFromNum: null },
  { num: 25, name_fr: 'Pikachu', name_en: 'Pikachu', types: ['electric'], sprite_url: '', evolvesFromNum: null },
];

const index = new Map<number, { set_ids: string[]; rarities: string[] }>([
  [1, { set_ids: ['base1'], rarities: ['Rare Holo'] }],
  [4, { set_ids: ['base1'], rarities: ['Rare Holo'] }],
  [25, { set_ids: ['base1', 'jungle'], rarities: ['Common'] }],
]);

describe('applyPokedexPipeline', () => {
  const owned = new Set([1, 25]);

  it('filters by status=owned', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'owned', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([1, 25]);
  });

  it('filters by status=missing', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'missing', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([4, 7]);
  });

  it('filters by type (mono and bi-type)', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: 'poison', setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([1]);
  });

  it('filters by set', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: 'jungle', rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('filters by rarity', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: 'Common', sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('combines filters (AND)', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'owned', typeFilter: 'electric', setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search by number substring', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '025', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search by short number', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '25', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search accent-insensitive on FR name', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: 'salameche', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([4]);
  });

  it('sort name asc/desc, insensitive to accents', () => {
    const asc = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'name-asc',
    });
    expect(asc.map(x => x.num)).toEqual([1, 7, 25, 4]);
    const desc = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'name-desc',
    });
    expect(desc.map(x => x.num)).toEqual([4, 25, 7, 1]);
  });

  it('filters by generation (Gen 1 = dex 1..151)', () => {
    const bigSample = [
      ...sample,
      { num: 152, name_fr: 'Germignon', name_en: 'Chikorita', types: ['grass'], sprite_url: '', evolvesFromNum: null },
      { num: 906, name_fr: 'Poussacha', name_en: 'Sprigatito', types: ['grass'], sprite_url: '', evolvesFromNum: null },
    ];
    const r = applyPokedexPipeline(bigSample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, generationFilter: 1, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([1, 4, 7, 25]);
  });

  it('filters by generation (Gen 9 = dex 906..1025)', () => {
    const bigSample = [
      ...sample,
      { num: 906, name_fr: 'Poussacha', name_en: 'Sprigatito', types: ['grass'], sprite_url: '', evolvesFromNum: null },
      { num: 1025, name_fr: 'Pêchaminus', name_en: 'Pecharunt', types: ['poison'], sprite_url: '', evolvesFromNum: null },
    ];
    const r = applyPokedexPipeline(bigSample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, generationFilter: 9, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([906, 1025]);
  });
});
