import { classifyRarity, isIllustrationRareTier } from '../lib/rarity-tiers';

describe('classifyRarity', () => {
  it('returns basic for a null rarity', () => {
    expect(classifyRarity(null)).toBe('basic');
  });

  it('returns basic for common/uncommon/promo/rare tiers', () => {
    expect(classifyRarity('Common')).toBe('basic');
    expect(classifyRarity('Uncommon')).toBe('basic');
    expect(classifyRarity('Promo')).toBe('basic');
    expect(classifyRarity('Rare')).toBe('basic');
  });

  it('returns chase for secret/rainbow/illustration-rare tiers', () => {
    expect(classifyRarity('Rare Secret')).toBe('chase');
    expect(classifyRarity('Rare Rainbow')).toBe('chase');
    expect(classifyRarity('Illustration Rare')).toBe('chase');
    expect(classifyRarity('Special Illustration Rare')).toBe('chase');
    expect(classifyRarity('LEGEND')).toBe('chase');
  });

  it('returns holo for anything not basic and not chase', () => {
    expect(classifyRarity('Rare Holo')).toBe('holo');
    expect(classifyRarity('Double Rare')).toBe('holo');
    expect(classifyRarity('some unknown future rarity string')).toBe('holo');
  });
});

describe('isIllustrationRareTier', () => {
  it('returns false for a null rarity', () => {
    expect(isIllustrationRareTier(null)).toBe(false);
  });

  it('returns true for illustration rare and special illustration rare', () => {
    expect(isIllustrationRareTier('Illustration Rare')).toBe(true);
    expect(isIllustrationRareTier('Special Illustration Rare')).toBe(true);
  });

  it('returns false for other rarities, including chase-tier ones', () => {
    expect(isIllustrationRareTier('Rare Secret')).toBe(false);
    expect(isIllustrationRareTier('Common')).toBe(false);
  });
});
