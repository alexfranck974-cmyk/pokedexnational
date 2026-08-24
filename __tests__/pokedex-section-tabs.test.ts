import { sectionIndex, hrefToSection } from '../components/PokedexSectionTabs';

describe('sectionIndex', () => {
  it('returns the position of each section in display order', () => {
    expect(sectionIndex('pokedex')).toBe(0);
    expect(sectionIndex('collection')).toBe(1);
    expect(sectionIndex('wishlist')).toBe(2);
  });
});

describe('hrefToSection', () => {
  it('resolves each route href to its section key', () => {
    expect(hrefToSection('/pokedex')).toBe('pokedex');
    expect(hrefToSection('/favorites')).toBe('collection');
    expect(hrefToSection('/wishlist')).toBe('wishlist');
  });

  it('returns null for an unrelated href', () => {
    expect(hrefToSection('/settings')).toBeNull();
  });
});
