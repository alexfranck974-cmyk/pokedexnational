import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Image, FlatList, Modal, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useCardsForPokemon } from '@/lib/tcg';
import { useAssignCardToSlot, useUploadBinderImage } from '@/lib/binders';
import { toast } from '@/lib/toast';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

// Matches the aspectRatio: 0.72 card tiles used everywhere else in the app.
const TARGET_RATIO = 0.72;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 6;
}

// Native allowsEditing+aspect already lets the user drag/zoom to a card-shaped
// crop on iOS/Android, but web has no such UI and the native crop isn't
// guaranteed pixel-exact either — so every picked photo still gets run through
// a deterministic center-crop to TARGET_RATIO before upload.
function centerCropRect(width: number, height: number) {
  const currentRatio = width / height;
  if (currentRatio > TARGET_RATIO) {
    const cropWidth = Math.round(height * TARGET_RATIO);
    return { originX: Math.round((width - cropWidth) / 2), originY: 0, width: cropWidth, height };
  }
  const cropHeight = Math.round(width / TARGET_RATIO);
  return { originX: 0, originY: Math.round((height - cropHeight) / 2), width, height: cropHeight };
}

interface Props {
  visible: boolean;
  binderId: string | null;
  /** Slot index being filled — always an empty slot, see favorites.tsx. */
  position: number | null;
  cardIdsInBinder: Set<string>;
  onClose: () => void;
}

type Mode = 'card' | 'photo';

// Same two-step "nom -> exemplaire" flow as the old CollectionCardPicker for
// cards, plus a "Photo" mode that picks from the camera roll, crops to the
// binder slot's aspect ratio, and uploads to the user's private Storage
// folder — either way a tap/pick assigns straight to the target slot and closes.
export function BinderSlotPicker({ visible, binderId, position, cardIdsInBinder, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [mode, setMode] = useState<Mode>('card');
  const [search, setSearch] = useState('');
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const assignCard = useAssignCardToSlot();
  const uploadImage = useUploadBinderImage();
  const { data: cards = [] } = useCardsForPokemon(selectedNum ?? undefined);

  useEffect(() => {
    if (!visible) { setSearch(''); setSelectedNum(null); setMode('card'); setUploading(false); }
  }, [visible]);

  const matches = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return [];
    return POKEDEX.filter((p) => normalize(getName(p)).includes(q) || String(p.num).includes(q)).slice(0, 30);
  }, [search]);

  const selected = selectedNum !== null ? POKEDEX.find((p) => p.num === selectedNum) : undefined;

  const pickPhoto = async () => {
    if (binderId == null || position == null) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Autorise l’accès à tes photos pour importer une image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [72, 100], quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const crop = centerCropRect(asset.width, asset.height);
      const manipulated = await manipulateAsync(
        asset.uri,
        [{ crop }, { resize: { width: 640 } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      await uploadImage.mutateAsync({ binderId, position, uri: manipulated.uri });
      onClose();
    } catch {
      toast('Impossible d’importer cette photo, réessaie.');
    } finally {
      setUploading(false);
    }
  };

  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, height: 640, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    modeRow: { flexDirection: 'row' as const, gap: spacing.sm, padding: spacing.md, paddingBottom: 0 },
    modeChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    modeChipActive: { backgroundColor: colors.primary },
    modeChipText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    modeChipTextActive: { color: 'white' },
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
    tileImgTaken: { opacity: 0.4 },
    takenBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.textDim, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    photoPane: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' as const },
    photoHint: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    photoBtn: {
      flexDirection: 'row' as const, gap: spacing.sm, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg,
    },
    photoBtnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 14 },
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
                {selected ? getName(selected) : mode === 'card' ? 'Choisir une carte' : 'Importer une photo'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {!selected && (
              <View style={styles.modeRow}>
                <Pressable onPress={() => setMode('card')} style={[styles.modeChip, mode === 'card' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, mode === 'card' && styles.modeChipTextActive]}>Carte</Text>
                </Pressable>
                <Pressable onPress={() => setMode('photo')} style={[styles.modeChip, mode === 'photo' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, mode === 'photo' && styles.modeChipTextActive]}>Photo</Text>
                </Pressable>
              </View>
            )}

            {mode === 'photo' && !selected ? (
              <View style={styles.photoPane}>
                <Text style={styles.photoHint}>
                  Importe une photo perso pour cet emplacement — elle sera recadrée au format d'une carte.
                </Text>
                <Pressable onPress={pickPhoto} disabled={uploading} style={styles.photoBtn}>
                  {uploading ? <ActivityIndicator color="white" /> : <Ionicons name="image-outline" size={18} color="white" />}
                  <Text style={styles.photoBtnText}>{uploading ? 'Import…' : 'Choisir une photo'}</Text>
                </Pressable>
              </View>
            ) : !selected ? (
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
                    keyExtractor={(p) => String(p.num)}
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
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => {
                  const taken = cardIdsInBinder.has(item.id);
                  return (
                    <Pressable
                      style={styles.tile}
                      onPress={() => {
                        if (taken || binderId == null || position == null) return;
                        assignCard.mutate({ binderId, position, cardId: item.id });
                        onClose();
                      }}>
                      <View style={styles.tileImgWrap}>
                        <Image
                          source={{ uri: item.image_small }}
                          style={[styles.tileImg, taken && styles.tileImgTaken]}
                          resizeMode="contain"
                        />
                        {taken && (
                          <View style={styles.takenBadge}>
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
