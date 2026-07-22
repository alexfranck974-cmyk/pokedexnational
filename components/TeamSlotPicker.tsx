import { View, Text, Image, Pressable, Modal, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface OwnedOption {
  pokemon: Pokemon;
  cardImage?: string;
}

interface Props {
  visible: boolean;
  options: OwnedOption[];
  onSelect: (dexNum: number) => void;
  onClose: () => void;
}

export function TeamSlotPicker({ visible, options, onSelect, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '75%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 400, height: 560, borderRadius: radius.xl, marginBottom: 40 },
    sheetHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    sheetTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: spacing.xl, fontStyle: 'italic' as const },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: 16, height: 56 },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    thumb: { width: 32, height: 32 },
    rowLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choisir un Pokémon</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {options.length === 0 ? (
            <Text style={styles.empty}>Tous tes Pokémon possédés sont déjà dans cette équipe.</Text>
          ) : (
            <FlatList
              data={options}
              keyExtractor={o => String(o.pokemon.num)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item.pokemon.num)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Image source={{ uri: item.cardImage ?? item.pokemon.sprite_url }} style={styles.thumb} resizeMode="contain" />
                  <Text style={styles.rowLabel}>#{String(item.pokemon.num).padStart(4, '0')} · {getName(item.pokemon)}</Text>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
