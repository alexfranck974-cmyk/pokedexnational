import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { fetchPublicProfile, useSession } from '@/lib/auth';
import { useUserDex } from '@/lib/collection';
import { CompareTile, COMPARE_BUCKET_COLOR, type CompareBucket } from '@/components/CompareTile';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useT } from '@/lib/locale';

const POKEDEX = pokedexData as Pokemon[];

type ProfileLite = { id: string; username: string; display_name: string };
type ProfileState = ProfileLite | 'notfound' | null;

function numColsFor(width: number): number {
  if (width < 600) return 4;
  if (width < 1024) return 6;
  return 9;
}

export default function ComparePokedexes() {
  const { a: usernameA, b: usernameB } = useLocalSearchParams<{ a: string; b: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const viewerId = session?.user.id;
  const { colors } = useTheme();
  const t = useT();

  const [profileA, setProfileA] = useState<ProfileState>(null);
  const [profileB, setProfileB] = useState<ProfileState>(null);

  useEffect(() => {
    let alive = true;
    setProfileA(null);
    setProfileB(null);
    fetchPublicProfile(usernameA as string, viewerId).then(p => { if (alive) setProfileA(p ?? 'notfound'); }).catch(() => { if (alive) setProfileA('notfound'); });
    fetchPublicProfile(usernameB as string, viewerId).then(p => { if (alive) setProfileB(p ?? 'notfound'); }).catch(() => { if (alive) setProfileB('notfound'); });
    return () => { alive = false; };
  }, [usernameA, usernameB, viewerId]);

  const { data: ownedA = new Set<number>() } = useUserDex(typeof profileA === 'object' && profileA ? profileA.id : undefined);
  const { data: ownedB = new Set<number>() } = useUserDex(typeof profileB === 'object' && profileB ? profileB.id : undefined);

  const buckets = useMemo(() => {
    const map = new Map<number, CompareBucket>();
    for (const p of POKEDEX) {
      const inA = ownedA.has(p.num);
      const inB = ownedB.has(p.num);
      map.set(p.num, inA && inB ? 'both' : inA ? 'onlyA' : inB ? 'onlyB' : 'neither');
    }
    return map;
  }, [ownedA, ownedB]);

  const counts = useMemo(() => {
    const result: Record<CompareBucket, number> = { both: 0, onlyA: 0, onlyB: 0, neither: 0 };
    for (const bucket of buckets.values()) result[bucket]++;
    return result;
  }, [buckets]);

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.md },
    notFoundTitle: { fontSize: 16, textAlign: 'center' as const, fontFamily: fonts.display, color: colors.text },
    header: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface, ...shadow.sm },
    backRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, alignSelf: 'flex-start' as const },
    backText: { fontSize: 14, fontFamily: fonts.body, color: colors.primary },
    namesRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.sm },
    nameA: { fontSize: 16, fontFamily: fonts.display, color: COMPARE_BUCKET_COLOR.onlyA, flexShrink: 1 },
    vs: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    nameB: { fontSize: 16, fontFamily: fonts.display, color: COMPARE_BUCKET_COLOR.onlyB, flexShrink: 1 },
    legendRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, justifyContent: 'center' as const },
    legendChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.text },
  }));

  if (profileA === null || profileB === null) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  }

  if (profileA === 'notfound' || profileB === 'notfound') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.notFoundTitle}>
          {profileA === 'notfound' && profileB === 'notfound' ? t('compare.bothNotFound')
            : profileA === 'notfound' ? t('compare.oneNotFound', { username: usernameA })
            : t('compare.oneNotFound', { username: usernameB })}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const legend: { bucket: CompareBucket; label: string }[] = [
    { bucket: 'both', label: t('compare.legendBoth', { n: counts.both }) },
    { bucket: 'onlyA', label: t('compare.legendOnlyOne', { name: profileA.display_name, n: counts.onlyA }) },
    { bucket: 'onlyB', label: t('compare.legendOnlyOne', { name: profileB.display_name, n: counts.onlyB }) },
    { bucket: 'neither', label: t('compare.legendNeither', { n: counts.neither }) },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <View style={styles.namesRow}>
          <Text style={styles.nameA} numberOfLines={1}>{profileA.display_name}</Text>
          <Text style={styles.vs}>vs</Text>
          <Text style={styles.nameB} numberOfLines={1}>{profileB.display_name}</Text>
        </View>
        <View style={styles.legendRow}>
          {legend.map(({ bucket, label }) => (
            <View key={bucket} style={styles.legendChip}>
              <View style={[styles.legendDot, { backgroundColor: COMPARE_BUCKET_COLOR[bucket] }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <FlashList
        data={POKEDEX}
        numColumns={numColsFor(width)}
        contentContainerStyle={{ padding: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE }}
        keyExtractor={p => String(p.num)}
        renderItem={({ item }) => !item ? null : (
          <CompareTile pokemon={item} bucket={buckets.get(item.num) ?? 'neither'} />
        )}
      />
    </SafeAreaView>
  );
}
