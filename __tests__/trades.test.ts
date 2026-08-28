import { eurFormatter, formatCardPriceRange, countMarketMatches, type FriendCardListing } from '../lib/trades';

function card(id: string, trendEur: number | null = null) {
  return { id, name: id, imageSmall: '', imageLarge: null, cardmarketTrendEur: trendEur };
}

function listing(friendId: string, cardId: string): FriendCardListing {
  return { friendId, friendName: friendId, card: card(cardId) };
}

describe('eurFormatter', () => {
  it('formats with a trailing € for fr', () => {
    expect(eurFormatter('fr').format(19.95)).toMatch(/^19,95\s?€$/);
  });

  it('formats with a leading € for en', () => {
    expect(eurFormatter('en').format(19.95)).toMatch(/^€\s?19\.95$/);
  });

  it('defaults to fr when no locale is given', () => {
    expect(eurFormatter().format(1)).toBe(eurFormatter('fr').format(1));
  });
});

describe('formatCardPriceRange', () => {
  it('returns null when there is no trend price', () => {
    expect(formatCardPriceRange(3, null, 'fr')).toBeNull();
    expect(formatCardPriceRange(3, undefined, 'fr')).toBeNull();
  });

  it('returns a single formatted price when there is no low price', () => {
    expect(formatCardPriceRange(null, 19.95, 'fr')).toMatch(/^19,95\s?€$/);
  });

  it('returns a single formatted price when low and trend are within a few cents', () => {
    expect(formatCardPriceRange(19.93, 19.95, 'fr')).toMatch(/^19,95\s?€$/);
  });

  it('returns a low–trend range when the spread is meaningful (fr)', () => {
    const result = formatCardPriceRange(15.51, 19.95, 'fr');
    expect(result).toMatch(/^15,51–19,95\s?€$/);
  });

  it('returns a low–trend range when the spread is meaningful (en)', () => {
    const result = formatCardPriceRange(15.51, 19.95, 'en');
    expect(result).toMatch(/^15\.51–€\s?19\.95$/);
  });

  it('treats exactly 0.05 spread as meaningful (boundary is exclusive)', () => {
    const result = formatCardPriceRange(19.90, 19.95, 'fr');
    expect(result).toMatch(/^19,90–19,95\s?€$/);
  });
});

describe('countMarketMatches', () => {
  it('counts cards a friend wants that I can fulfill from a duplicate', () => {
    const wanted = [listing('friend-1', 'card-a')];
    const n = countMarketMatches([], wanted, new Set(), new Set(['card-a']));
    expect(n).toBe(1);
  });

  it('counts cards a friend has spare that I have on my wishlist', () => {
    const available = [listing('friend-1', 'card-b')];
    const n = countMarketMatches(available, [], new Set(['card-b']), new Set());
    expect(n).toBe(1);
  });

  it('sums both directions independently, not just mutual matches', () => {
    const available = [listing('friend-1', 'card-b')];
    const wanted = [listing('friend-1', 'card-a')];
    const n = countMarketMatches(available, wanted, new Set(['card-b']), new Set(['card-a']));
    expect(n).toBe(2);
  });

  it('returns 0 when nothing matches', () => {
    const available = [listing('friend-1', 'card-b')];
    const wanted = [listing('friend-1', 'card-a')];
    const n = countMarketMatches(available, wanted, new Set(), new Set());
    expect(n).toBe(0);
  });
});
