import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Image, FlatList, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useCardsForPokemon } from '@/lib/tcg';
import { useAddCardToCollection, useRemoveCardFromCollection } from '@/lib/collections';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 6;
}

interface Props {
  visible: boolean;
  collectionId: string | null;
  cardIdsInCollection: Set<string>;
  onClose: () => void;
}

export function CollectionCardPicker({ visible, collectionId, cardIdsInCollection, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [search, setSearch] = useState('');
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const addCard = useAddCardToCollection();
  const removeCard = useRemoveCardFromCollection();
  const { data: cards = [] } = useCardsForPokemon(selectedNum ?? undefined);

  useEffect(() => {
    if (!visible) { setSearch(''); setSelectedNum(null); }
  }, [visible]);

  const matches = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return [];
    return POKEDEX.filter(p => normalize(getName(p)).includes(q) || String(p.num).includes(q)).slice(0, 30);
  }, [search]);

  const selected = selectedNum !== null ? POKEDEX.find(p => p.num === selectedNum) : undefined;

  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, height: 640, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    search: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: spacing.xl, fontStyle: 'italic' as const },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: 16, height: 52 },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    thumb: { width: 32, height: 32 },
    rowLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.text, flex: 1 },
    rowDex: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim },
    grid: { padding: spacing.sm },
    tile: { flex: 1, padding: 6, alignItems: 'center' as const },
    tileImgWrap: { position: 'relative' as const, width: '100%' as const },
    tileImg: { width: '100%' as const, aspectRatio: 0.72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    tileImgSelected: { opacity: 0.55 },
    checkBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.success, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
            <View style={styles.header}>
              {selected ? (
                <Pressable onPress={() => setSelectedNum(null)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={20} color="#818cf8" />
                </Pressable>
              ) : null}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selected ? getName(selected) : 'Ajouter des cartes'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {!selected ? (
              <>
                <TextInput
                  placeholder="Chercher un Pokémon (nom ou n°)"
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  style={styles.search}
                />
                {matches.length === 0 ? (
                  <Text style={styles.empty}>{search.trim() ? 'Aucun résultat.' : 'Tape un nom ou un numéro pour chercher.'}</Text>
                ) : (
                  <FlatList
                    data={matches}
                    keyExtractor={p => String(p.num)}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => setSelectedNum(item.num)}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                        <Image source={{ uri: item.sprite_url }} style={styles.thumb} resizeMode="contain" />
                        <Text style={styles.rowLabel} numberOfLines={1}>{getName(item)}</Text>
                        <Text style={styles.rowDex}>#{String(item.num).padStart(4, '0')}</Text>
                      </Pressable>
                    )}
                  />
                )}
              </>
            ) : cards.length === 0 ? (
              <Text style={styles.empty}>Aucune carte TCG connue pour ce Pokémon.</Text>
            ) : (
              <FlatList
                data={cards}
                numColumns={numColsFor(width)}
                contentContainerStyle={styles.grid}
                keyExtractor={c => c.id}
                renderItem={({ item }) => {
                  const inCollection = cardIdsInCollection.has(item.id);
                  return (
                    <Pressable
                      style={styles.tile}
                      onPress={() => {
                        if (!collectionId) return;
                        if (inCollection) removeCard.mutate({ collectionId, cardId: item.id });
                        else addCard.mutate({ collectionId, cardId: item.id });
                      }}>
                      <View style={styles.tileImgWrap}>
                        <Image
                          source={{ uri: item.image_small }}
                          style={[styles.tileImg, inCollection && styles.tileImgSelected]}
                          resizeMode="contain"
                        />
                        {inCollection && (
                          <View style={styles.checkBadge}>
                            <Ionicons name="checkmark" size={14} color="white" />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
    </Modal>
  );
}
