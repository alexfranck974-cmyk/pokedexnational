import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet, FlatList, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useSession } from '@/lib/auth';
import { useUserDex, useOwnedCardImages } from '@/lib/collection';
import { useFavorites, useToggleFavorite } from '@/lib/favorites';
import {
  useTeams, useCreateTeam, useRenameTeam, useDeleteTeam, useSetTeamSlot, useClearTeamSlot,
} from '@/lib/teams';
import { FavoriteTile } from '@/components/FavoriteTile';
import { TeamSlotPicker } from '@/components/TeamSlotPicker';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));
const TEAM_SIZE = 6;

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
  const { data: favorites = new Set<number>() } = useFavorites(userId);
  const toggleFavorite = useToggleFavorite();

  const { data: teams = [] } = useTeams(userId);
  const createTeam = useCreateTeam();
  const renameTeam = useRenameTeam();
  const deleteTeam = useDeleteTeam();
  const setSlot = useSetTeamSlot();
  const clearSlot = useClearTeamSlot();

  const [subTab, setSubTab] = useState<'favorites' | 'teams'>('favorites');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const ownedPokemon = useMemo(() => POKEDEX.filter(p => owned.has(p.num)), [owned]);
  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;

  const pickerOptions = useMemo(() => {
    if (!selectedTeam) return [];
    const used = new Set(selectedTeam.slots.map(s => s.dexNum));
    return ownedPokemon
      .filter(p => !used.has(p.num))
      .map(p => ({ pokemon: p, cardImage: ownedImages.get(p.num) }));
  }, [selectedTeam, ownedPokemon, ownedImages]);

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    const id = await createTeam.mutateAsync(name);
    setNewTeamName('');
    setSelectedTeamId(id);
  };

  const confirmDeleteTeam = (teamId: string, name: string) => {
    Alert.alert('Supprimer l’équipe', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => { deleteTeam.mutate(teamId); if (selectedTeamId === teamId) setSelectedTeamId(null); },
      },
    ]);
  };

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    header: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, ...shadow.sm },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
    chipRow: { flexDirection: 'row' as const, gap: spacing.xs },
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
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoris & Équipes</Text>
        <View style={styles.chipRow}>
          <Chip label="Favoris" active={subTab === 'favorites'} onPress={() => setSubTab('favorites')} />
          <Chip label="Équipes" active={subTab === 'teams'} onPress={() => setSubTab('teams')} />
        </View>
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
                onPress={() => router.push(`/pokemon/${item.num}`)}
                onToggleFavorite={() => toggleFavorite.mutate({ dexNum: item.num, currentlyFavorited: favorites.has(item.num) })}
              />
            )}
          />
        )
      ) : selectedTeam ? (
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
            <Pressable onPress={() => confirmDeleteTeam(selectedTeam.id, selectedTeam.name)} hitSlop={8}>
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
    </SafeAreaView>
  );
}
