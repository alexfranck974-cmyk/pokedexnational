import { getName } from '../lib/i18n';

describe('getName', () => {
  it('prefers FR when present', () => {
    expect(getName({ name_fr: 'Pikachu', name_en: 'Pikachu' })).toBe('Pikachu');
    expect(getName({ name_fr: 'Bulbizarre', name_en: 'Bulbasaur' })).toBe('Bulbizarre');
  });
  it('falls back to EN when FR is null', () => {
    expect(getName({ name_fr: null, name_en: 'Sprigatito' })).toBe('Sprigatito');
  });
});
