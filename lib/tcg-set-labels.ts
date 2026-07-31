// English labels for Japanese TCG set names, so "Filtrer par extension" is
// navigable without reading Japanese (e.g. finding "Abyss Eye" instead of only
// ever seeing "アビスアイ"). Keyed by the literal Japanese set_name already stored
// on the card row — not by set_id/code — because TCGdex's own set id↔name mapping
// has at least one known inconsistency (both SV3a and SV4a are stored under the
// Japanese name "レイジングサーフ" in our data), so matching on the actual displayed
// name is the only way to guarantee the label is never wrong for what's shown.
//
// Sourced from Bulbapedia's Japanese TCG expansion list (verified 2026-07-31).
// A handful of starter-deck/product-bundle releases aren't in that list and are
// deliberately left untranslated below rather than guessed — extend this table
// as more gaps are found, same pattern as EN_GAP_SET_IDS in the sync script.
export const JP_SET_NAME_EN: Record<string, string> = {
  '黒炎の支配者': 'Ruler of the Black Flame',
  'レイジングサーフ': 'Raging Surf',
  '古代の咆哮': 'Ancient Roar',
  'VSTARユニバース': 'VSTAR Universe',
  'スターバース': 'Star Birth',
  'パラダイムトリガー': 'Paradigm Trigger',
  'バトルリージョン': 'Battle Region',
  '未来の一閃': 'Future Flash',
  'スノーハザード': 'Snow Hazard',
  'トリプレットビート': 'Triplet Beat',
  'クリムゾンヘイズ': 'Crimson Haze',
  'ステラミラクル': 'Stellar Miracle',
  '熱風のアリーナ': 'Hot Wind Arena',
  'バトルパートナーズ': 'Battle Partners',
  'ポケモンカード151': 'Pokémon Card 151',
  'クレイバースト': 'Clay Burst',
  'バイオレットex': 'Violet ex',
  'テラスタルフェスex': 'Terastal Fest ex',
  '超電ブレイカー': 'Super Electric Breaker',
  '楽園ドラゴーナ': 'Paradise Dragona',
  'ワイルドフォース': 'Wild Force',
  'ロケット団の栄光': 'Glory of the Rocket Gang',
  'スカーレットex': 'Scarlet ex',
  'ブラックボルト': 'Black Bolt',
  'ホワイトフレア': 'White Flare',
  '変幻の仮面': 'Transformation Mask',
  'メガ プロモカード': 'Mega Promo Cards',
  'メガブレイブ': 'Mega Brave',
  'メガシンフォニア': 'Mega Symphonia',
  'インフェルノX': 'Inferno X',
  'MEGAドリームex': 'MEGA Dream ex',
  'ムニキスゼロ': 'Nihil Zero',
  'ニンジャスピナー': 'Ninja Spinner',
  'アビスアイ': 'Abyss Eye',
};

export function setDisplayName(setName: string): string {
  const en = JP_SET_NAME_EN[setName];
  return en ? `${en} · ${setName}` : setName;
}
