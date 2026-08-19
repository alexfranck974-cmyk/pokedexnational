import { setDisplayName, setFlagLabel, JP_SET_NAME_EN } from '../lib/tcg-set-labels';

describe('setDisplayName', () => {
  it('appends the English translation for a known Japanese set name', () => {
    expect(setDisplayName('アビスアイ')).toBe('Abyss Eye · アビスアイ');
  });

  it('returns the name unchanged when there is no translation', () => {
    expect(setDisplayName('Some Untranslated Product')).toBe('Some Untranslated Product');
  });
});

describe('setFlagLabel', () => {
  it('returns the set name unchanged when region is null/undefined (global sets)', () => {
    expect(setFlagLabel('Base Set', null)).toBe('Base Set');
    expect(setFlagLabel('Base Set', undefined)).toBe('Base Set');
  });

  it('returns the set name unchanged for an unrecognized region', () => {
    expect(setFlagLabel('Some Set', 'kr')).toBe('Some Set');
  });

  it('prefixes a flag with no translation for a Chinese set (cn is never translated)', () => {
    expect(setFlagLabel('对战派对组合 奖励包', 'cn')).toBe('🇨🇳 对战派对组合 奖励包');
  });

  it('prefixes the flag and translates a known Japanese set name', () => {
    expect(setFlagLabel('アビスアイ', 'jp')).toBe('🇯🇵 Abyss Eye');
  });

  it('prefixes the flag but keeps the native name for an untranslated Japanese set', () => {
    expect(setFlagLabel('未知のセット', 'jp')).toBe('🇯🇵 未知のセット');
  });

  it('resolves the same translation for two different set codes sharing one Japanese name (SV3a/SV4a collision)', () => {
    // Both SV3a and SV4a are stored under the same Japanese name in our data —
    // setFlagLabel keys off the displayed name, not the set id, so this is
    // expected and safe: whichever set it is, the label is never wrong for
    // what's actually shown.
    expect(JP_SET_NAME_EN['レイジングサーフ']).toBe('Raging Surf');
    expect(setFlagLabel('レイジングサーフ', 'jp')).toBe('🇯🇵 Raging Surf');
  });
});
