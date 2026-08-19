import { buildSetTypeGroups, typesCompletedByToggle } from '../lib/set-type-completion';
import type { TcgCardRow } from '../lib/tcg';

function card(overrides: Partial<TcgCardRow> & { id: string }): TcgCardRow {
  return {
    name: overrides.id,
    set_id: 'base1',
    set_name: 'Base',
    card_number: '1',
    rarity: null,
    image_small: '',
    image_large: null,
    release_date: null,
    series: 'Base',
    region: 'global',
    dex_num: 1,
    types: [],
    ...overrides,
  };
}

describe('buildSetTypeGroups', () => {
  it('groups dex numbers by TCG-printed type, deduping repeats of the same dex_num', () => {
    const cards = [
      card({ id: 'a', dex_num: 1, types: ['Grass'] }),
      card({ id: 'b', dex_num: 1, types: ['Grass'] }), // same dex_num, second printing
      card({ id: 'c', dex_num: 4, types: ['Fire'] }),
    ];
    const groups = buildSetTypeGroups(cards);
    expect(groups.get('Grass')).toEqual([1]);
    expect(groups.get('Fire')).toEqual([4]);
  });

  it('excludes cards with no dex_num', () => {
    const cards = [card({ id: 'trainer', dex_num: undefined, types: ['Colorless'] })];
    expect(buildSetTypeGroups(cards).size).toBe(0);
  });

  it('excludes a dex number whose only printing in the set is illustration-rare', () => {
    const cards = [card({ id: 'a', dex_num: 1, types: ['Grass'], rarity: 'Illustration Rare' })];
    const groups = buildSetTypeGroups(cards);
    expect(groups.get('Grass') ?? []).toEqual([]);
  });

  it('still includes a dex number if a non-illustration-rare printing exists, regardless of array order', () => {
    const cards = [
      card({ id: 'ir', dex_num: 1, types: ['Grass'], rarity: 'Illustration Rare' }),
      card({ id: 'normal', dex_num: 1, types: ['Grass'], rarity: 'Common' }),
    ];
    expect(buildSetTypeGroups(cards).get('Grass')).toEqual([1]);
  });

  it('a multi-type card contributes its dex number to every one of its types', () => {
    const cards = [card({ id: 'a', dex_num: 1, types: ['Grass', 'Poison'] })];
    const groups = buildSetTypeGroups(cards);
    expect(groups.get('Grass')).toEqual([1]);
    expect(groups.get('Poison')).toEqual([1]);
  });
});

describe('typesCompletedByToggle', () => {
  const cards = [
    card({ id: 'grass-1', dex_num: 1, types: ['Grass'] }),
    card({ id: 'grass-2', dex_num: 2, types: ['Grass'] }),
    card({ id: 'fire-1', dex_num: 4, types: ['Fire'] }),
  ];
  const typeGroups = buildSetTypeGroups(cards);

  it('returns the type when toggling the last missing card completes it', () => {
    const before = new Set(['grass-1']); // dex 1 owned, dex 2 missing
    const result = typesCompletedByToggle(cards[1], cards, before, typeGroups); // toggle grass-2
    expect(result).toEqual(['Grass']);
  });

  it('returns empty when the type was already complete before the toggle', () => {
    const before = new Set(['grass-1', 'grass-2']);
    const result = typesCompletedByToggle(cards[1], cards, before, typeGroups);
    expect(result).toEqual([]);
  });

  it('returns empty when the type is still incomplete after the toggle', () => {
    const before = new Set<string>();
    const result = typesCompletedByToggle(cards[0], cards, before, typeGroups); // only grass-1, grass-2 still missing
    expect(result).toEqual([]);
  });

  it('returns empty for a card with no dex_num', () => {
    const trainer = card({ id: 'trainer', dex_num: undefined, types: ['Colorless'] });
    expect(typesCompletedByToggle(trainer, cards, new Set(), typeGroups)).toEqual([]);
  });

  it('does not count an illustration-rare copy as satisfying its dex slot', () => {
    const irCards = [
      card({ id: 'grass-1', dex_num: 1, types: ['Grass'] }),
      card({ id: 'grass-2-ir', dex_num: 2, types: ['Grass'], rarity: 'Illustration Rare' }),
      card({ id: 'grass-2-normal', dex_num: 2, types: ['Grass'], rarity: 'Common' }),
    ];
    const groups = buildSetTypeGroups(irCards);
    const before = new Set(['grass-1']);
    // Toggling the illustration-rare copy of dex 2 should NOT complete Grass —
    // only the normal copy counts toward the requirement.
    const result = typesCompletedByToggle(irCards[1], irCards, before, groups);
    expect(result).toEqual([]);
  });
});
