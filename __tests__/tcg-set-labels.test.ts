import { setDisplayName, setFlagLabel, JP_SET_NAME_EN, CN_SET_NAME_EN } from '../lib/tcg-set-labels';

describe('setDisplayName', () => {
  it('appends the English translation for a known Japanese set id', () => {
    expect(setDisplayName('アビスアイ', 'jp-M5')).toBe('Abyss Eye · アビスアイ');
  });

  it('returns the name unchanged when there is no translation for that id', () => {
    expect(setDisplayName('Some Untranslated Product', 'global-unknown')).toBe('Some Untranslated Product');
  });
});

describe('setFlagLabel', () => {
  it('returns the set name unchanged when region is null/undefined (global sets)', () => {
    expect(setFlagLabel('Base Set', null, 'base1')).toBe('Base Set');
    expect(setFlagLabel('Base Set', undefined, 'base1')).toBe('Base Set');
  });

  it('returns the set name unchanged for an unrecognized region', () => {
    expect(setFlagLabel('Some Set', 'kr', 'kr1')).toBe('Some Set');
  });

  it('prefixes the flag and translates a known Mainland China set', () => {
    expect(setFlagLabel('对战派对组合 奖励包', 'cn', 'cn-csmpic')).toBe('🇨🇳 Battle Party Set Reward Pack');
  });

  it('prefixes the flag but keeps the native name for an untranslated Chinese set id', () => {
    expect(setFlagLabel('未知のセット', 'cn', 'cn-unknown')).toBe('🇨🇳 未知のセット');
  });

  it('prefixes the flag and translates a known Japanese set name', () => {
    expect(setFlagLabel('アビスアイ', 'jp', 'jp-M5')).toBe('🇯🇵 Abyss Eye');
  });

  it('prefixes the flag but keeps the native name for an untranslated Japanese set id', () => {
    expect(setFlagLabel('未知のセット', 'jp', 'jp-unknown')).toBe('🇯🇵 未知のセット');
  });

  it('resolves two different, correct translations for jp-SV3a/jp-SV4a despite them sharing one Japanese display name', () => {
    // Both ids are stored under the same Japanese name "レイジングサーフ" in our
    // data (a TCGdex quirk — see sync-tcgplayer-images.ts's comment on
    // jp-SV4a) but are genuinely different real-world sets. Keying by id
    // (not by the displayed name) is what makes both resolve correctly
    // instead of one of them silently getting the other's translation.
    expect(JP_SET_NAME_EN['jp-SV3a']).toBe('Raging Surf');
    expect(JP_SET_NAME_EN['jp-SV4a']).toBe('Shiny Treasure ex');
    expect(setFlagLabel('レイジングサーフ', 'jp', 'jp-SV3a')).toBe('🇯🇵 Raging Surf');
    expect(setFlagLabel('レイジングサーフ', 'jp', 'jp-SV4a')).toBe('🇯🇵 Shiny Treasure ex');
  });

  it('gives Taiwan (cn-<code>) and Japan (jp-<code>) their own independent translation for the same underlying set code', () => {
    expect(CN_SET_NAME_EN['cn-SV7']).toBe('Stellar Miracle');
    expect(JP_SET_NAME_EN['jp-SV7']).toBe('Stellar Miracle');
  });
});
