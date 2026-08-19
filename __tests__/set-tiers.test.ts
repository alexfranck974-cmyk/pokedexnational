import { currentSetTier, getSetTierLabel, SET_TIERS } from '../lib/set-tiers';

describe('currentSetTier', () => {
  it('returns undefined below the first tier', () => {
    expect(currentSetTier(0)).toBeUndefined();
    expect(currentSetTier(24)).toBeUndefined();
  });

  it('returns the tier exactly at its boundary', () => {
    expect(currentSetTier(25)?.label).toBe('Découverte');
    expect(currentSetTier(50)?.label).toBe('Collection');
    expect(currentSetTier(75)?.label).toBe('Expertise');
    expect(currentSetTier(90)?.label).toBe('Presque complet');
    expect(currentSetTier(100)?.label).toBe('Set complet');
  });

  it('returns the highest tier crossed, not the next one', () => {
    expect(currentSetTier(49)?.label).toBe('Découverte');
    expect(currentSetTier(74)?.label).toBe('Collection');
    expect(currentSetTier(89)?.label).toBe('Expertise');
    expect(currentSetTier(99)?.label).toBe('Presque complet');
  });
});

describe('getSetTierLabel', () => {
  it('returns the French label by default', () => {
    expect(getSetTierLabel(SET_TIERS[0], 'fr')).toBe('Découverte');
  });

  it('returns the English label for locale en', () => {
    expect(getSetTierLabel(SET_TIERS[0], 'en')).toBe('Discovery');
  });
});
