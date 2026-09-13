import { useState } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { buildEvolutionStages } from '@/lib/evolutions';
import type { StringKey } from '@/lib/strings';
import { TYPE_COLORS } from '@/lib/types-colors';
import { withAlpha } from '@/lib/color-utils';
import { useLocale, useT, type Locale } from '@/lib/locale';
import { useTheme, useThemedStyles, type ColorTokens, type ShadowTokens, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  pokemon: Pokemon;
  byDex: Map<number, Pokemon>;
  onSelectPokemon: (num: number) => void;
}

// Stat bars are scaled against this rather than the true 0-255 ceiling
// (Blissey's HP) — almost nothing gets close to 255, so anchoring there would
// make every other bar for the "average" Pokémon look empty. Values above
// this just clip to a full bar.
const STAT_BAR_MAX = 180;

const EVO_TILE_HEIGHT = 104;
const EVO_GROUP_HEIGHT = EVO_TILE_HEIGHT * 2 + 12;

const STAT_ROWS: { key: keyof Pokemon['stats']; labelKey: StringKey }[] = [
  { key: 'hp', labelKey: 'pokemon.statHp' },
  { key: 'attack', labelKey: 'pokemon.statAttack' },
  { key: 'defense', labelKey: 'pokemon.statDefense' },
  { key: 'specialAttack', labelKey: 'pokemon.statSpAttack' },
  { key: 'specialDefense', labelKey: 'pokemon.statSpDefense' },
  { key: 'speed', labelKey: 'pokemon.statSpeed' },
];

function makeStyles(colors: ColorTokens, shadow: ShadowTokens) {
  return {
    toggle: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    toggleText: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.lg },
    description: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 19 },
    sectionLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, textTransform: 'uppercase' as const },
    statsBlock: { gap: 6, marginTop: spacing.sm },
    statRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    statLabel: { width: 62, fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    statBarTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' as const },
    statBarFill: { height: '100%' as const, borderRadius: radius.pill, backgroundColor: colors.primary },
    statValue: { width: 32, fontSize: 12, fontFamily: fonts.monoBold, color: colors.text, textAlign: 'right' as const },
    statTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 2 },
    statTotalLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    statTotalValue: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.text },
    // Horizontal "evolutionary line" — a scroll strip, not a vertically
    // stacked list. Branching families (Eevee's 8 evolutions) wrap into extra
    // columns within a fixed-height group instead of growing the row taller,
    // so this section's total height stays constant regardless of family
    // size or branch count — the reason the last stage used to end up
    // hidden behind the floating tab bar on tall/branching families.
    evoScroll: { marginTop: spacing.sm },
    evoScrollContent: { alignItems: 'center' as const, paddingHorizontal: spacing.xs, gap: spacing.sm },
    evoStageGroup: {
      flexDirection: 'column' as const, flexWrap: 'wrap' as const,
      height: EVO_GROUP_HEIGHT, alignContent: 'center' as const, gap: spacing.sm,
    },
    evoConnector: { width: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
    evoTile: { alignItems: 'center' as const, width: 78, height: EVO_TILE_HEIGHT, gap: 3 },
    evoSpriteWrap: {
      width: 64, height: 64, borderRadius: 32,
      alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const,
    },
    evoSpriteWrapCurrent: { borderWidth: 2.5, borderColor: colors.primary, ...shadow.sm },
    evoSprite: { width: '82%' as const, height: '82%' as const },
    evoName: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    evoNum: { fontSize: 10, fontFamily: fonts.mono, color: colors.textDim },
    noEvolutionText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
  };
}

export function PokemonInfoPanel({ pokemon, byDex, onSelectPokemon }: Props) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const styles = useThemedStyles(makeStyles);

  const description = (locale === 'fr' ? pokemon.description_fr : pokemon.description_en)
    ?? pokemon.description_en ?? pokemon.description_fr;
  const total = STAT_ROWS.reduce((sum, row) => sum + pokemon.stats[row.key], 0);
  const stages = buildEvolutionStages(pokemon, byDex);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={t('pokemon.a11yToggleInfo')}>
        <Ionicons name="book-outline" size={16} color={colors.text} />
        <Text style={styles.toggleText}>{t('pokemon.infoSectionTitle')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Text style={styles.description}>{description ?? t('pokemon.noDescription')}</Text>

          <View>
            <Text style={styles.sectionLabel}>{t('pokemon.statsTitle')}</Text>
            <View style={styles.statsBlock}>
              {STAT_ROWS.map(row => {
                const value = pokemon.stats[row.key];
                const pct = Math.min(100, Math.round((value / STAT_BAR_MAX) * 100));
                return (
                  <View key={row.key} style={styles.statRow}>
                    <Text style={styles.statLabel}>{t(row.labelKey)}</Text>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.statValue}>{value}</Text>
                  </View>
                );
              })}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>{t('pokemon.statTotal')}</Text>
                <Text style={styles.statTotalValue}>{total}</Text>
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>{t('pokemon.evolutionsTitle')}</Text>
            {stages.length <= 1 ? (
              <Text style={[styles.noEvolutionText, { marginTop: spacing.sm }]}>{t('pokemon.noEvolution')}</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.evoScroll}
                contentContainerStyle={styles.evoScrollContent}>
                {stages.map((stage, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.evoStageGroup}>
                      {stage.map(mon => {
                        const isCurrent = mon.num === pokemon.num;
                        const typeColor = TYPE_COLORS[mon.types[0]] ?? '#888888';
                        return (
                          <Pressable
                            key={mon.num}
                            style={styles.evoTile}
                            disabled={isCurrent}
                            onPress={() => onSelectPokemon(mon.num)}>
                            <View
                              style={[
                                styles.evoSpriteWrap,
                                { backgroundColor: withAlpha(typeColor, 0.22) },
                                isCurrent && styles.evoSpriteWrapCurrent,
                              ]}>
                              <Image source={{ uri: mon.sprite_url }} style={styles.evoSprite} resizeMode="contain" />
                            </View>
                            <Text style={styles.evoName} numberOfLines={1}>{getName(mon, locale as Locale)}</Text>
                            <Text style={styles.evoNum}>#{String(mon.num).padStart(4, '0')}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {i < stages.length - 1 && (
                      <View style={styles.evoConnector}>
                        <Ionicons name="arrow-forward" size={18} color={colors.textDim} />
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
