import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet, FlatList, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useSession } from '@/lib/auth';
import { useUserDex, useOwnedCardImages, useAllOwnedCardIds } from '@/lib/collection';
import { useFavorites, useToggleFavorite, useShowcase, useToggleShowcase } from '@/lib/favorites';
import { toast } from '@/lib/toast';
import { enterPokemonDetail } from '@/lib/navigation';
import {
  useTeams, useCreateTeam, useRenameTeam, useDeleteTeam, useSetTeamSlot, useClearTeamSlot,
} from '@/lib/teams';
import {
  useCollections, useCreateCollection, useRenameCollection, useDeleteCollection,
  useCollectionCards, useRemoveCardFromCollection,
} from '@/lib/collections';
import { FavoriteTile } from '@/components/FavoriteTile';
import { TeamSlotPicker } from '@/components/TeamSlotPicker';
import { CollectionCardPicker } from '@/components/CollectionCardPicker';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));
const TEAM_SIZE = 6;
const VITRINE_LIMIT = 6;

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const chipStyles = useThemedStyles((colors) => ({
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    active: { backgroundColor: colors.primary },
    text: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    textActive: { color: 'white' },
  }));
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: favorites = new Set<number>() } = useFavorites(userId);
  const toggleFavorite = useToggleFavorite();
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const toggleShowcase = useToggleShowcase();

  const { data: teams = [] } = useTeams(userId);
  const createTeam = useCreateTeam();
  const renameTeam = useRenameTeam();
  const deleteTeam = useDeleteTeam();
  const setSlot = useSetTeamSlot();
  const clearSlot = useClearTeamSlot();

  const { data: collections = [] } = useCollections(userId);
  const createCollection = useCreateCollection();
  const renameCollection = useRenameCollection();
  const deleteCollection = useDeleteCollection();
  const removeCardFromCollection = useRemoveCardFromCollection();

  const [subTab, setSubTab] = useState<'favorites' | 'teams' | 'collections'>('favorites');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collectionRenaming, setCollectionRenaming] = useState(false);
  const [collectionRenameValue, setCollectionRenameValue] = useState('');
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'team' | 'collection'; id: string; name: string } | null>(null);

  const ownedPokemon = useMemo(() => POKEDEX.filter(p => owned.has(p.num)), [owned]);
  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;
  const selectedCollection = collections.find(c => c.id === selectedCollectionId) ?? null;
  const { data: collectionCards = [] } = useCollectionCards(selectedCollectionId ?? undefined);
  const collectionCardIds = useMemo(() => new Set(collectionCards.map(c => c.cardId)), [collectionCards]);

  const pickerOptions = useMemo(() => {
    if (!selectedTeam) return [];
    const used = new Set(selectedTeam.slots.map(s => s.dexNum));
    return ownedPokemon
      .filter(p => !used.has(p.num))
      .map(p => ({ pokemon: p, cardImage: ownedImages.get(p.num) }));
  }, [selectedTeam, ownedPokemon, ownedImages]);

  const handleToggleShowcase = (dexNum: number) => {
    const currentlyInShowcase = showcase.has(dexNum);
    if (!currentlyInShowcase && showcase.size >= VITRINE_LIMIT) {
      toast(`Vitrine limitée à ${VITRINE_LIMIT} cartes — retire-en une avant d’en ajouter une autre.`);
      return;
    }
    toggleShowcase.mutate({ dexNum, currentlyFavorited: favorites.has(dexNum), currentlyInShowcase });
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    const id = await createTeam.mutateAsync(name);
    setNewTeamName('');
    setSelectedTeamId(id);
  };

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const id = await createCollection.mutateAsync(name);
    setNewCollectionName('');
    setSelectedCollectionId(id);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'team') {
      deleteTeam.mutate(deleteTarget.id);
      if (selectedTeamId === deleteTarget.id) setSelectedTeamId(null);
    } else {
      deleteCollection.mutate(deleteTarget.id);
      if (selectedCollectionId === deleteTarget.id) setSelectedCollectionId(null);
    }
    setDeleteTarget(null);
  };

  const confirmTarget: ConfirmTarget | null = deleteTarget
    ? {
        title: deleteTarget.kind === 'team' ? 'Supprimer l’équipe' : 'Supprimer la collection',
        message: `Supprimer "${deleteTarget.name}" ?`,
      }
    : null;

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    header: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, ...shadow.sm },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
    chipRow: { flexDirection: 'row' as const, gap: spacing.xs },
    legend: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim },
    emptyTitle: { fontSize: 18, fontFamily: fonts.display, textAlign: 'center' as const, color: colors.text },
    emptyHint: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },

    teamList: { flex: 1, padding: spacing.md, gap: spacing.md },
    newTeamRow: { flexDirection: 'row' as const, gap: spacing.sm },
    newTeamInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, backgroundColor: colors.surfaceAlt, color: colors.text },
    newTeamBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
    teamRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.sm,
    },
    teamRowPressed: { backgroundColor: colors.surfaceAlt },
    teamRowName: { flex: 1, fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    teamRowCount: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },

    teamEditor: { flex: 1, padding: spacing.md, gap: spacing.md },
    teamEditorHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    teamEditorTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
    renameInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 8, fontSize: 16, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },

    slotGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    slot: {
      width: '31%' as const, aspectRatio: 0.85, backgroundColor: colors.surface, borderRadius: radius.md,
      alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xs, ...shadow.sm, position: 'relative' as const,
    },
    slotSprite: { width: '80%' as const, height: '60%' as const },
    slotName: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const, marginTop: 2 },
    slotClear: { position: 'absolute' as const, top: 2, right: 2 },
    slotEmpty: {
      width: '100%' as const, height: '100%' as const, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed' as const,
      borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
    },

    addCardsBtn: {
      flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm,
    },
    addCardsBtnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 14 },
    collectionTile: { flex: 1, padding: 6 },
    collectionImgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.md, padding: 2 },
    holoInner: { borderRadius: radius.md - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    collectionImg: { width: '100%' as const, aspectRatio: 0.72 },
    removeBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {subTab === 'favorites' ? 'Favoris' : subTab === 'teams' ? 'Équipes' : 'Collections'}
        </Text>
        <View style={styles.chipRow}>
          <Chip label="Favoris" active={subTab === 'favorites'} onPress={() => setSubTab('favorites')} />
          <Chip label="Équipes" active={subTab === 'teams'} onPress={() => setSubTab('teams')} />
          <Chip label="Collections" active={subTab === 'collections'} onPress={() => setSubTab('collections')} />
        </View>
        {subTab === 'favorites' && (
          <Text style={styles.legend}>
            ★ Favori · ✨ Vitrine (max {VITRINE_LIMIT}) — mise en avant sur ton Dashboard et ton profil public
          </Text>
        )}
      </View>

      {subTab === 'favorites' ? (
        ownedPokemon.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Aucun Pokémon possédé</Text>
            <Text style={styles.emptyHint}>Ajoute des cartes depuis le Pokédex pour pouvoir les mettre en favoris.</Text>
          </View>
        ) : (
          <FlashList
            data={ownedPokemon}
            numColumns={numColsFor(width)}
            estimatedItemSize={120}
            keyExtractor={p => String(p.num)}
            renderItem={({ item }) => (
              <FavoriteTile
                pokemon={item}
                cardImage={ownedImages.get(item.num)}
                favorited={favorites.has(item.num)}
                inShowcase={showcase.has(item.num)}
                onPress={() => enterPokemonDetail(router, `/pokemon/${item.num}`)}
                onToggleFavorite={() => toggleFavorite.mutate({ dexNum: item.num, currentlyFavorited: favorites.has(item.num) })}
                onToggleShowcase={() => handleToggleShowcase(item.num)}
              />
            )}
          />
        )
      ) : subTab === 'teams' ? (
        selectedTeam ? (
          <View style={styles.teamEditor}>
            <View style={styles.teamEditorHeader}>
              <Pressable onPress={() => { setSelectedTeamId(null); setRenaming(false); }} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
              </Pressable>
              {renaming ? (
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  style={styles.renameInput}
                  onSubmitEditing={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                  onBlur={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => { setRenameValue(selectedTeam.name); setRenaming(true); }}>
                  <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedTeam.name}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setDeleteTarget({ kind: 'team', id: selectedTeam.id, name: selectedTeam.name })} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            <View style={styles.slotGrid}>
              {Array.from({ length: TEAM_SIZE }, (_, i) => i).map(slotIndex => {
                const slot = selectedTeam.slots.find(s => s.slotIndex === slotIndex);
                const mon = slot ? POKEDEX_BY_DEX.get(slot.dexNum) : undefined;
                return (
                  <Pressable key={slotIndex} onPress={() => setPickerSlot(slotIndex)} style={styles.slot}>
                    {mon ? (
                      <>
                        <Image source={{ uri: ownedImages.get(mon.num) ?? mon.sprite_url }} style={styles.slotSprite} resizeMode="contain" />
                        <Text style={styles.slotName} numberOfLines={1}>{getName(mon)}</Text>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => { e.stopPropagation(); clearSlot.mutate({ teamId: selectedTeam.id, slotIndex }); }}
                          style={styles.slotClear}>
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                        </Pressable>
                      </>
                    ) : (
                      <View style={styles.slotEmpty}>
                        <Ionicons name="add" size={22} color={colors.textDim} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.teamList}>
            <View style={styles.newTeamRow}>
              <TextInput
                placeholder="Nom de la nouvelle équipe"
                value={newTeamName}
                onChangeText={setNewTeamName}
                onSubmitEditing={handleCreateTeam}
                style={styles.newTeamInput}
              />
              <Pressable onPress={handleCreateTeam} style={styles.newTeamBtn}>
                <Ionicons name="add" size={20} color="white" />
              </Pressable>
            </View>

            {teams.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyHint}>Aucune équipe pour l’instant — crée-en une ci-dessus.</Text>
              </View>
            ) : (
              <FlatList
                data={teams}
                keyExtractor={t => t.id}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setSelectedTeamId(item.id)} style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                    <Text style={styles.teamRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.teamRowCount}>{item.slots.length}/{TEAM_SIZE}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        )
      ) : selectedCollection ? (
        <View style={styles.teamEditor}>
          <View style={styles.teamEditorHeader}>
            <Pressable onPress={() => { setSelectedCollectionId(null); setCollectionRenaming(false); }} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            {collectionRenaming ? (
              <TextInput
                value={collectionRenameValue}
                onChangeText={setCollectionRenameValue}
                autoFocus
                style={styles.renameInput}
                onSubmitEditing={() => { renameCollection.mutate({ collectionId: selectedCollection.id, name: collectionRenameValue.trim() || selectedCollection.name }); setCollectionRenaming(false); }}
                onBlur={() => { renameCollection.mutate({ collectionId: selectedCollection.id, name: collectionRenameValue.trim() || selectedCollection.name }); setCollectionRenaming(false); }}
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => { setCollectionRenameValue(selectedCollection.name); setCollectionRenaming(true); }}>
                <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedCollection.name}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setDeleteTarget({ kind: 'collection', id: selectedCollection.id, name: selectedCollection.name })} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>

          <Pressable onPress={() => setCardPickerOpen(true)} style={styles.addCardsBtn}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.addCardsBtnText}>Ajouter des cartes</Text>
          </Pressable>

          {collectionCards.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>Aucune carte — touche "Ajouter des cartes".</Text>
            </View>
          ) : (
            <FlashList
              data={collectionCards}
              numColumns={numColsFor(width)}
              estimatedItemSize={200}
              keyExtractor={c => c.cardId}
              renderItem={({ item }) => {
                const isOwned = ownedCardIds.has(item.cardId);
                return (
                  <View style={styles.collectionTile}>
                    <View style={styles.collectionImgWrap}>
                      {isOwned ? (
                        <LinearGradient
                          colors={[colors.primary, colors.warning, colors.primary]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={styles.holoBorder}>
                          <View style={styles.holoInner}>
                            <Image source={{ uri: item.imageSmall }} style={styles.collectionImg} resizeMode="contain" />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={styles.plainInner}>
                          <Image source={{ uri: item.imageSmall }} style={styles.collectionImg} resizeMode="contain" />
                        </View>
                      )}
                      <Pressable
                        hitSlop={8}
                        onPress={() => removeCardFromCollection.mutate({ collectionId: selectedCollection.id, cardId: item.cardId })}
                        style={styles.removeBtn}>
                        <Ionicons name="close" size={16} color="white" />
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        <View style={styles.teamList}>
          <View style={styles.newTeamRow}>
            <TextInput
              placeholder="Nom de la nouvelle collection"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              onSubmitEditing={handleCreateCollection}
              style={styles.newTeamInput}
            />
            <Pressable onPress={handleCreateCollection} style={styles.newTeamBtn}>
              <Ionicons name="add" size={20} color="white" />
            </Pressable>
          </View>

          {collections.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>Aucune collection pour l’instant — crée-en une ci-dessus.</Text>
            </View>
          ) : (
            <FlatList
              data={collections}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => setSelectedCollectionId(item.id)} style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                  <Text style={styles.teamRowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.teamRowCount}>{item.cardIds.length} carte{item.cardIds.length > 1 ? 's' : ''}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      <TeamSlotPicker
        visible={pickerSlot !== null}
        options={pickerOptions}
        onSelect={(dexNum) => {
          if (selectedTeam && pickerSlot !== null) {
            setSlot.mutate({ teamId: selectedTeam.id, slotIndex: pickerSlot, dexNum });
          }
          setPickerSlot(null);
        }}
        onClose={() => setPickerSlot(null)}
      />

      <CollectionCardPicker
        visible={cardPickerOpen}
        collectionId={selectedCollectionId}
        cardIdsInCollection={collectionCardIds}
        onClose={() => setCardPickerOpen(false)}
      />

      <ConfirmDialog
        target={confirmTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}
