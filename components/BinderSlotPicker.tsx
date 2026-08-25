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
import { getFinishLabel, type OwnedCardFinish } from '@/lib/collection';
import { toast } from '@/lib/toast';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useLocale, useT } from '@/lib/locale';
import { BackButton } from './BackButton';

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
  /** Finishes already placed per card_id in this binder — a card can occupy
   * two slots (its normal print and its reverse-holo print), so this is
   * keyed per-finish, not just per-card. See 052_binder_slot_finish.sql. */
  finishesByCardId: Map<string, Set<OwnedCardFinish>>;
  onClose: () => void;
}

type Mode = 'card' | 'photo';

// Binders only ever distinguish normal vs. reverse-holo prints (never plain
// 'holo' — that's its own separate printed card_id in most sets, not a
// finish toggle on the same print), matching useCreatePrefilledBinder's
// includeReverse wizard option.
const BINDER_FINISHES: OwnedCardFinish[] = ['normal', 'reverse_holo'];

// Same two-step "nom -> exemplaire" flow as the old CollectionCardPicker for
// cards, plus a "Photo" mode that picks from the camera roll, crops to the
// binder slot's aspect ratio, and uploads to the user's private Storage
// folder — either way a tap/pick assigns straight to the target slot and closes.
export function BinderSlotPicker({ visible, binderId, position, finishesByCardId, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { locale } = useLocale();
  const t = useT();
  const [mode, setMode] = useState<Mode>('card');
  const [search, setSearch] = useState('');
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [finish, setFinish] = useState<OwnedCardFinish>('normal');
  const [uploading, setUploading] = useState(false);
  const assignCard = useAssignCardToSlot();
  const uploadImage = useUploadBinderImage();
  const { data: cards = [] } = useCardsForPokemon(selectedNum ?? undefined);

  useEffect(() => {
    if (!visible) { setSearch(''); setSelectedNum(null); setMode('card'); setFinish('normal'); setUploading(false); }
  }, [visible]);
  useEffect(() => { setFinish('normal'); }, [selectedNum]);

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
      toast(t('binderPicker.photoPermToast'));
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
      toast(t('binderPicker.photoImportErrToast'));
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
    finishRow: { flexDirection: 'row' as const, gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    finishChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    finishChipActive: { backgroundColor: colors.primary },
    finishChipText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    finishChipTextActive: { color: 'white' },
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
                <BackButton onPress={() => setSelectedNum(null)} color="#818cf8" size={20} />
              ) : null}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selected ? getName(selected, locale) : mode === 'card' ? t('binderPicker.chooseCardTitle') : t('binderPicker.importPhotoTitle')}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {!selected && (
              <View style={styles.modeRow}>
                <Pressable onPress={() => setMode('card')} style={[styles.modeChip, mode === 'card' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, mode === 'card' && styles.modeChipTextActive]}>{t('binderPicker.modeCard')}</Text>
                </Pressable>
                <Pressable onPress={() => setMode('photo')} style={[styles.modeChip, mode === 'photo' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, mode === 'photo' && styles.modeChipTextActive]}>{t('binderPicker.modePhoto')}</Text>
                </Pressable>
              </View>
            )}

            {mode === 'photo' && !selected ? (
              <View style={styles.photoPane}>
                <Text style={styles.photoHint}>
                  {t('binderPicker.photoHint')}
                </Text>
                <Pressable onPress={pickPhoto} disabled={uploading} style={styles.photoBtn}>
                  {uploading ? <ActivityIndicator color="white" /> : <Ionicons name="image-outline" size={18} color="white" />}
                  <Text style={styles.photoBtnText}>{uploading ? t('binderPicker.importing') : t('binderPicker.choosePhoto')}</Text>
                </Pressable>
              </View>
            ) : !selected ? (
              <>
                <TextInput
                  placeholder={t('binderPicker.searchPlaceholder')}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  style={styles.search}
                />
                {matches.length === 0 ? (
                  <Text style={styles.empty}>{search.trim() ? t('favorites.noResults') : t('binderPicker.typeToSearch')}</Text>
                ) : (
                  <FlatList
                    data={matches}
                    keyExtractor={(p) => String(p.num)}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => setSelectedNum(item.num)}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                        <Image source={{ uri: item.sprite_url }} style={styles.thumb} resizeMode="contain" />
                        <Text style={styles.rowLabel} numberOfLines={1}>{getName(item, locale)}</Text>
                        <Text style={styles.rowDex}>#{String(item.num).padStart(4, '0')}</Text>
                      </Pressable>
                    )}
                  />
                )}
              </>
            ) : cards.length === 0 ? (
              <Text style={styles.empty}>{t('binderPicker.noCardsForPokemon')}</Text>
            ) : (
              <>
                {cards.some(c => !c.available_finishes || c.available_finishes.length === 0 || c.available_finishes.includes('reverse_holo')) && (
                  <View style={styles.finishRow}>
                    {BINDER_FINISHES.map(f => (
                      <Pressable
                        key={f}
                        onPress={() => setFinish(f)}
                        style={[styles.finishChip, finish === f && styles.finishChipActive]}>
                        <Text style={[styles.finishChipText, finish === f && styles.finishChipTextActive]}>
                          {getFinishLabel(f, locale)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <FlatList
                  data={cards}
                  numColumns={numColsFor(width)}
                  contentContainerStyle={styles.grid}
                  keyExtractor={(c) => c.id}
                  renderItem={({ item }) => {
                    // available_finishes null/empty means unsynced/unknown — never
                    // treat that as "doesn't come in this finish", only an explicit
                    // list that omits reverse_holo does.
                    const knownFinishes = item.available_finishes;
                    const unsupported = finish === 'reverse_holo' && !!knownFinishes && knownFinishes.length > 0 && !knownFinishes.includes('reverse_holo');
                    const taken = !unsupported && (finishesByCardId.get(item.id)?.has(finish) ?? false);
                    const disabled = taken || unsupported;
                    return (
                      <Pressable
                        style={styles.tile}
                        onPress={() => {
                          if (disabled || binderId == null || position == null) return;
                          assignCard.mutate({ binderId, position, cardId: item.id, finish });
                          onClose();
                        }}>
                        <View style={styles.tileImgWrap}>
                          <Image
                            source={{ uri: item.image_small }}
                            style={[styles.tileImg, disabled && styles.tileImgTaken]}
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
              </>
            )}
          </Pressable>
        </Pressable>
    </Modal>
  );
}
