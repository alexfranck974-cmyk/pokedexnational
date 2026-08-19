import { computeBadges, type DashboardStats } from '../lib/badges';
import type { VariantCategory, Progress } from '../lib/dashboard-stats';
import type { OwnedCardDetail } from '../lib/collection';

const emptyProgress = (): Progress => ({ owned: 0, total: 10, pct: 0 });

const ALL_VARIANT_CATEGORIES: VariantCategory[] = [
  'mega', 'alolan', 'galarian', 'hisuian', 'paldean', 'rotom', 'deoxys', 'gigamax',
];

function baseStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    overall: { owned: 0, total: 1025, pct: 0 },
    byGeneration: [],
    variants: Object.fromEntries(
      ALL_VARIANT_CATEGORIES.map(c => [c, emptyProgress()]),
    ) as Record<VariantCategory, Progress>,
    ownedCards: [],
    ownedCardIds: new Set(),
    wishedCardIds: new Set(),
    wishlistCount: 0,
    collectionValue: 0,
    bySet: [],
    completedTradesCount: 0,
    ...overrides,
  };
}

function card(overrides: Partial<OwnedCardDetail> = {}): OwnedCardDetail {
  return {
    cardId: 'base1-1',
    dexNum: 1,
    acquiredAt: '2026-01-01T00:00:00Z',
    rarity: 'Common',
    name: 'Bulbasaur',
    imageSmall: 'x',
    imageLarge: null,
    cardmarketTrendEur: null,
    artist: null,
    ...overrides,
  };
}

function badge(stats: DashboardStats, id: string, locale: 'fr' | 'en' = 'fr') {
  const found = computeBadges(stats, locale).find(b => b.id === id);
  if (!found) throw new Error(`badge ${id} not found`);
  return found;
}

describe('computeBadges — milestone badges', () => {
  it('unlocks progressively as overall.pct crosses each threshold', () => {
    const stats = baseStats({ overall: { owned: 750, total: 1025, pct: 75 } });
    expect(badge(stats, 'national-25').unlockedNow).toBe(true);
    expect(badge(stats, 'national-50').unlockedNow).toBe(true);
    expect(badge(stats, 'national-75').unlockedNow).toBe(true);
    expect(badge(stats, 'national-100').unlockedNow).toBe(false);
  });

  it('caps progress at 100 even past the threshold', () => {
    const stats = baseStats({ overall: { owned: 1025, total: 1025, pct: 100 } });
    expect(badge(stats, 'national-25').progressNow).toBe(100);
  });
});

describe('computeBadges — generation badges', () => {
  it('unlocks a generation badge once every Pokémon in it is owned, and labels it by region', () => {
    const stats = baseStats({ byGeneration: [{ gen: 1, label: 'Gen 1 · Kanto', labelEn: 'Gen 1 · Kanto', owned: 151, total: 151, pct: 100 }] });
    const fr = badge(stats, 'gen-1', 'fr');
    expect(fr.unlockedNow).toBe(true);
    expect(fr.label).toBe('Maître de Kanto');
    const en = badge(stats, 'gen-1', 'en');
    expect(en.label).toBe('Kanto Master');
  });

  it('stays locked when the generation is incomplete, and defaults to 0 progress for a generation absent from stats', () => {
    const stats = baseStats({ byGeneration: [{ gen: 1, label: 'Gen 1 · Kanto', labelEn: 'Gen 1 · Kanto', owned: 100, total: 151, pct: 66 }] });
    expect(badge(stats, 'gen-1').unlockedNow).toBe(false);
    const gen2 = badge(stats, 'gen-2');
    expect(gen2.unlockedNow).toBe(false);
    expect(gen2.progressNow).toBe(0);
  });
});

describe('computeBadges — variant badges', () => {
  it('unlocks once a variant category is fully owned', () => {
    const stats = baseStats({
      variants: {
        ...baseStats().variants,
        mega: { owned: 10, total: 10, pct: 100 },
      },
    });
    expect(badge(stats, 'variant-mega').unlockedNow).toBe(true);
    expect(badge(stats, 'variant-alolan').unlockedNow).toBe(false);
  });
});

describe('computeBadges — rarity badges', () => {
  it('rarity-holo unlocks on any non-basic rarity, rarity-chase only on chase-tier rarities', () => {
    const holoOnly = baseStats({ ownedCards: [card({ rarity: 'Rare Holo' })] });
    expect(badge(holoOnly, 'rarity-holo').unlockedNow).toBe(true);
    expect(badge(holoOnly, 'rarity-chase').unlockedNow).toBe(false);

    const chase = baseStats({ ownedCards: [card({ rarity: 'Rare Secret' })] });
    expect(badge(chase, 'rarity-holo').unlockedNow).toBe(true);
    expect(badge(chase, 'rarity-chase').unlockedNow).toBe(true);

    const basicOnly = baseStats({ ownedCards: [card({ rarity: 'Common' })] });
    expect(badge(basicOnly, 'rarity-holo').unlockedNow).toBe(false);
  });
});

describe('computeBadges — date badges', () => {
  it('date-first unlocks as soon as any card is owned', () => {
    expect(badge(baseStats(), 'date-first').unlockedNow).toBe(false);
    expect(badge(baseStats({ ownedCards: [card()] }), 'date-first').unlockedNow).toBe(true);
  });

  it('date-sprint unlocks once 10 cards land within any 7-day window', () => {
    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const tenWithin5Days = Array.from({ length: 10 }, (_, i) => new Date(base + i * 12 * 60 * 60 * 1000).toISOString());
    const stats = baseStats({ ownedCards: tenWithin5Days.map(d => card({ acquiredAt: d })) });
    expect(badge(stats, 'date-sprint').unlockedNow).toBe(true);

    const spreadOut = Array.from({ length: 5 }, (_, i) => new Date(base + i * 20 * 24 * 60 * 60 * 1000).toISOString());
    const notSprint = baseStats({ ownedCards: spreadOut.map(d => card({ acquiredAt: d })) });
    expect(badge(notSprint, 'date-sprint').unlockedNow).toBe(false);
  });

  it('date-streak unlocks on 4 consecutive active weeks, not just 4 active weeks total', () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const consecutive = [10, 11, 12, 13].map(w => new Date(w * WEEK_MS + 1000).toISOString());
    expect(badge(baseStats({ ownedCards: consecutive.map(d => card({ acquiredAt: d })) }), 'date-streak').unlockedNow).toBe(true);

    const withGap = [0, 1, 3, 4].map(w => new Date(w * WEEK_MS + 1000).toISOString());
    expect(badge(baseStats({ ownedCards: withGap.map(d => card({ acquiredAt: d })) }), 'date-streak').unlockedNow).toBe(false);
  });
});

describe('computeBadges — wishlist badges', () => {
  it('wish-fulfilled unlocks when an owned card is also (or was) on the wishlist', () => {
    const stats = baseStats({ ownedCardIds: new Set(['base1-1']), wishedCardIds: new Set(['base1-1']) });
    expect(badge(stats, 'wish-fulfilled').unlockedNow).toBe(true);
    expect(badge(baseStats(), 'wish-fulfilled').unlockedNow).toBe(false);
  });

  it('wish-dreamer unlocks at 10+ wishlisted cards', () => {
    expect(badge(baseStats({ wishlistCount: 9 }), 'wish-dreamer').unlockedNow).toBe(false);
    expect(badge(baseStats({ wishlistCount: 10 }), 'wish-dreamer').unlockedNow).toBe(true);
  });
});

describe('computeBadges — value badges', () => {
  it('unlocks each collection-value threshold independently', () => {
    const stats = baseStats({ collectionValue: 750 });
    expect(badge(stats, 'value-100').unlockedNow).toBe(true);
    expect(badge(stats, 'value-500').unlockedNow).toBe(true);
    expect(badge(stats, 'value-1000').unlockedNow).toBe(false);
    expect(badge(stats, 'value-5000').unlockedNow).toBe(false);
  });
});

describe('computeBadges — trade badges', () => {
  it('unlocks each trade-count threshold independently', () => {
    const stats = baseStats({ completedTradesCount: 5 });
    expect(badge(stats, 'trade-1').unlockedNow).toBe(true);
    expect(badge(stats, 'trade-5').unlockedNow).toBe(true);
    expect(badge(stats, 'trade-15').unlockedNow).toBe(false);
  });
});

describe('computeBadges — artist badge', () => {
  it('unlocks once 5+ owned cards share the same artist', () => {
    const fourCards = baseStats({ ownedCards: Array.from({ length: 4 }, (_, i) => card({ cardId: `c${i}`, artist: 'Ken Sugimori' })) });
    expect(badge(fourCards, 'artist-fan').unlockedNow).toBe(false);

    const fiveCards = baseStats({ ownedCards: Array.from({ length: 5 }, (_, i) => card({ cardId: `c${i}`, artist: 'Ken Sugimori' })) });
    expect(badge(fiveCards, 'artist-fan').unlockedNow).toBe(true);
  });
});

describe('computeBadges — set badges', () => {
  it('builds one badge per set tier, unlocked/progressing off that set’s own completion, labelled per locale', () => {
    const stats = baseStats({ bySet: [{ setId: 'base1', setName: 'Base Set', symbol: null, owned: 50, total: 100 }] });
    const fr = badge(stats, 'set-base1-25', 'fr');
    expect(fr.unlockedNow).toBe(true); // 50% owned clears the 25% tier
    expect(fr.label).toBe('Base Set — Découverte');
    const en = badge(stats, 'set-base1-25', 'en');
    expect(en.label).toBe('Base Set — Discovery');

    expect(badge(stats, 'set-base1-50').unlockedNow).toBe(true);
    expect(badge(stats, 'set-base1-75').unlockedNow).toBe(false);
  });

  it('produces no set badges when bySet is empty', () => {
    expect(computeBadges(baseStats()).some(b => b.id.startsWith('set-'))).toBe(false);
  });
});
