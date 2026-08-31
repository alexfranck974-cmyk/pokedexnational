import { useMemo } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BubbleSheet } from './BubbleSheet';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import { withAlpha } from '@/lib/color-utils';

export type ToolTab = 'artists' | 'duplicates' | 'trainers' | 'duo' | 'tag';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (tab: ToolTab) => void;
}

// Hand-picked illustration crops (already landscape-composed, no card frame
// or attack text) — one per tab today, but the array is the point: dropping
// more files in here is all "alternance" (rotate a random pick per open)
// will ever need, no code change. Bundled assets, not card-DB URLs, so no
// network fetch to defer — the sheet renders instantly on open.
const TOOL_ART: Partial<Record<ToolTab, number[]>> = {
  duo: [require('../assets/tools/duo-1.png')],
  tag: [require('../assets/tools/tag-1.png')],
  trainers: [require('../assets/tools/trainers-1.png')],
};

// One steady pick per mount — `tab` is a fixed literal per call site, so this
// never reshuffles while the sheet stays open.
function useToolArt(tab: ToolTab): number | undefined {
  return useMemo(() => {
    const pool = TOOL_ART[tab];
    if (!pool || pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [tab]);
}

// The "outils de recherche" drawer for Favoris — curated slices of the whole
// TCG index (Duos/Tag/Dresseurs/Artistes/Doublons), as opposed to the
// showcase tabs (Extensions/Binders/Scellés) that stay in the primary chip
// row. Step 1 of the progressive redesign: a plain sheet behind a button, not
// yet the pull-tab drawer gesture — see conversation for why.
export function CollectionToolsSheet({ visible, onClose, onSelect }: Props) {
  const t = useT();
  const { colors } = useTheme();

  const duoArt = useToolArt('duo');
  const tagArt = useToolArt('tag');
  const trainerArt = useToolArt('trainers');

  const tiles: { key: ToolTab; label: string; art?: number; icon?: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'duo', label: t('favorites.tabDuo'), art: duoArt },
    { key: 'tag', label: t('favorites.tabTag'), art: tagArt },
    { key: 'trainers', label: t('favorites.tabTrainers'), art: trainerArt },
    { key: 'artists', label: t('favorites.tabArtists'), icon: 'color-palette-outline' },
    { key: 'duplicates', label: t('favorites.tabDuplicates'), icon: 'copy-outline' },
  ];

  const styles = useThemedStyles((colors) => ({
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, padding: spacing.md },
    tile: {
      width: '47%' as const, aspectRatio: 1.6, borderRadius: radius.lg, overflow: 'hidden' as const,
      backgroundColor: colors.surfaceAlt, justifyContent: 'flex-end' as const,
    },
    tileImg: { position: 'absolute' as const, top: 0, left: 0, width: '100%' as const, height: '100%' as const },
    iconWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    tileLabelWrap: { padding: spacing.sm },
    tileLabel: { fontSize: 14, fontFamily: fonts.bodyBold, color: 'white' },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={colors.primary} title={t('favorites.toolsSheetTitle')} sizing="auto">
      <View style={styles.grid}>
        {tiles.map(tile => (
          <Pressable key={tile.key} onPress={() => { onSelect(tile.key); onClose(); }} style={styles.tile}>
            {tile.art ? (
              <>
                <Image source={tile.art} style={styles.tileImg} resizeMode="cover" />
                {/* Scrim only over the lower half, where the label sits — the art
                    itself stays vivid instead of washed out across the whole tile. */}
                <LinearGradient
                  colors={[withAlpha('#000000', 0), withAlpha('#000000', 0.75)]}
                  start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </>
            ) : tile.icon ? (
              <View style={styles.iconWrap}>
                <Ionicons name={tile.icon} size={32} color={colors.textMuted} />
              </View>
            ) : null}
            <View style={styles.tileLabelWrap}>
              <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </BubbleSheet>
  );
}
