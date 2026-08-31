import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BubbleSheet } from './BubbleSheet';
import { useTrainerCards, useCharacterRareCards, useTagTeamCards, type TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

export type ToolTab = 'artists' | 'duplicates' | 'trainers' | 'duo' | 'tag';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (tab: ToolTab) => void;
}

// One steady pick per fetch (not per render) — cards only changes once
// react-query resolves, so this doesn't reshuffle while the sheet is open.
function useRandomCardImage(cards: TcgCardRow[] | undefined): string | undefined {
  return useMemo(() => {
    if (!cards || cards.length === 0) return undefined;
    return cards[Math.floor(Math.random() * cards.length)].image_small;
  }, [cards]);
}

// The "outils de recherche" drawer for Favoris — curated slices of the whole
// TCG index (Duos/Tag/Dresseurs/Artistes/Doublons), as opposed to the
// showcase tabs (Extensions/Binders/Scellés) that stay in the primary chip
// row. Step 1 of the progressive redesign: a plain sheet behind a button, not
// yet the pull-tab drawer gesture — see conversation for why.
//
// Mounted lazily (only once `visible` first goes true) so the three card
// hooks below don't fetch on every Favoris visit just to sit unused behind a
// closed sheet — but once mounted it stays mounted (BubbleSheet's own
// `visible` toggles the slide animation instead), so re-opening doesn't
// re-fetch and closing doesn't cut the slide-down animation short.
export function CollectionToolsSheet({ visible, onClose, onSelect }: Props) {
  const [everOpened, setEverOpened] = useState(visible);
  useEffect(() => { if (visible) setEverOpened(true); }, [visible]);
  if (!everOpened) return null;
  return <CollectionToolsSheetInner visible={visible} onClose={onClose} onSelect={onSelect} />;
}

function CollectionToolsSheetInner({ visible, onClose, onSelect }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const { data: trainerCards } = useTrainerCards();
  const { data: duoCards } = useCharacterRareCards();
  const { data: tagCards } = useTagTeamCards();

  const trainerImg = useRandomCardImage(trainerCards);
  const duoImg = useRandomCardImage(duoCards);
  const tagImg = useRandomCardImage(tagCards);

  const tiles: { key: ToolTab; label: string; image?: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'duo', label: t('favorites.tabDuo'), image: duoImg },
    { key: 'tag', label: t('favorites.tabTag'), image: tagImg },
    { key: 'trainers', label: t('favorites.tabTrainers'), image: trainerImg },
    { key: 'artists', label: t('favorites.tabArtists'), icon: 'color-palette-outline' },
    { key: 'duplicates', label: t('favorites.tabDuplicates'), icon: 'copy-outline' },
  ];

  const styles = useThemedStyles((colors) => ({
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, padding: spacing.md },
    tile: {
      width: '47%' as const, aspectRatio: 1.6, borderRadius: radius.lg, overflow: 'hidden' as const,
      backgroundColor: colors.surfaceAlt, justifyContent: 'flex-end' as const,
    },
    tileImg: { opacity: 0.4 },
    iconWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    tileLabelWrap: { padding: spacing.sm, backgroundColor: colors.overlay },
    tileLabel: { fontSize: 14, fontFamily: fonts.bodyBold, color: 'white' },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={colors.primary} title={t('favorites.toolsSheetTitle')} sizing="auto">
      <View style={styles.grid}>
        {tiles.map(tile => (
          <Pressable key={tile.key} onPress={() => { onSelect(tile.key); onClose(); }} style={styles.tile}>
            {tile.image ? (
              <Image source={{ uri: tile.image }} style={[StyleSheet.absoluteFill, styles.tileImg]} resizeMode="cover" />
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
