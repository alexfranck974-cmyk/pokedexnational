import { useMemo, useRef, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useBinders, useBinderCards, BINDER_LAYOUT_COLS } from '@/lib/binders';
import { useOwnedCardFinishes, type OwnedCardFinish } from '@/lib/collection';
import { Pokeball } from '@/components/Pokeball';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { useBackTo } from '@/lib/navigation';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

// Read-only "vitrine" viewer — a real binder, flipped page by page (swipe or
// arrows), no add/remove affordances. Reached from the editable grid in
// favorites.tsx via the eye icon. Unlike the editor (which pads a trailing
// empty page so there's always somewhere to add a card), this only ever shows
// pages up to the last filled one — an empty binder still gets one blank page.
export default function BinderViewerScreen() {
  const { binderId } = useLocalSearchParams<{ binderId: string }>();
  const goBack = useBackTo('/favorites');
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors, heroGradient, heroText, heroTextMuted } = useTheme();
  const { width } = useWindowDimensions();
  const t = useT();

  const { data: binders = [], isLoading: bindersLoading } = useBinders(userId);
  const binder = binders.find((b) => b.id === binderId);
  const { data: slots = [], isLoading: slotsLoading } = useBinderCards(binderId);
  const { data: finishesByCard = new Map<string, OwnedCardFinish[]>() } = useOwnedCardFinishes(userId);

  const [pageIndex, setPageIndex] = useState(0);
  const [zoomTarget, setZoomTarget] = useState<ZoomableCard | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const layout = binder?.layout ?? 9;
  const cols = BINDER_LAYOUT_COLS[layout];

  const byPosition = useMemo(() => new Map(slots.map((s) => [s.position, s])), [slots]);
  const maxPosition = useMemo(() => slots.reduce((m, s) => Math.max(m, s.position), -1), [slots]);
  const pageCount = Math.max(1, Math.ceil((maxPosition + 1) / layout));

  const goToPage = (i: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, i));
    setPageIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: heroText, fontSize: 14, fontFamily: fonts.body },
    heroTitle: { flex: 1, fontSize: 17, fontFamily: fonts.display, color: heroText, textAlign: 'center' as const },
    heroPage: { fontSize: 12, fontFamily: fonts.mono, color: heroTextMuted },
    page: { justifyContent: 'center' as const, padding: spacing.md },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const },
    slot: { padding: 6 },
    slotImgWrap: { position: 'relative' as const },
    slotImg: { borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    slotEmpty: { borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed' as const, borderColor: colors.border },
    notOwnedBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    reverseHoloBadge: {
      position: 'absolute' as const, bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
      borderWidth: 1, borderColor: '#8fa3b3',
    },
    reverseHoloBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#8fa3b3' },
    navBtn: {
      position: 'absolute' as const, top: '50%' as const, marginTop: -22, width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: 0.92, ...shadow.md,
    },
    navBtnLeft: { left: spacing.sm },
    navBtnRight: { right: spacing.sm },
    empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    emptyText: { fontFamily: fonts.body, color: colors.textMuted, fontStyle: 'italic' as const },
  }));

  if (!binder) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.empty}>
          {(bindersLoading || slotsLoading) ? <ActivityIndicator /> : <Text style={styles.emptyText}>Binder introuvable.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const pageContentWidth = width - spacing.md * 2;
  const slotWidth = pageContentWidth / cols - 12;
  const slotHeight = slotWidth / 0.72;

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={heroText} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.heroTitle} numberOfLines={1}>{binder.name}</Text>
        <Text style={styles.heroPage}>
          {pageIndex + 1}/{pageCount} · {t(slots.length > 1 ? 'favorites.binderCardCountPlural' : 'favorites.binderCardCountSingular', { n: slots.length })}
        </Text>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}>
          {Array.from({ length: pageCount }, (_, page) => (
            <View key={page} style={[styles.page, { width }]}>
              <View style={styles.grid}>
                {Array.from({ length: layout }, (_, i) => {
                  const position = page * layout + i;
                  const item = byPosition.get(position);
                  if (!item) {
                    return (
                      <View key={position} style={[styles.slot, { width: slotWidth + 12 }]}>
                        <View style={[styles.slotEmpty, { width: slotWidth, height: slotHeight }]} />
                      </View>
                    );
                  }
                  const isCard = item.kind === 'card';
                  const itemFinish: OwnedCardFinish = item.finish ?? 'normal';
                  const isOwned = isCard && (finishesByCard.get(item.cardId as string)?.includes(itemFinish) ?? false);
                  return (
                    <Pressable
                      key={position}
                      style={[styles.slot, { width: slotWidth + 12 }]}
                      onPress={() => setZoomTarget({ image_small: item.imageUrl })}>
                      <View style={styles.slotImgWrap}>
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={[styles.slotImg, { width: slotWidth, height: slotHeight }]}
                          resizeMode={isCard ? 'contain' : 'cover'}
                        />
                        {isCard && !isOwned && (
                          <View style={styles.notOwnedBadge}><Pokeball size={14} muted /></View>
                        )}
                        {isCard && itemFinish === 'reverse_holo' && !isOwned && (
                          <View style={styles.reverseHoloBadge}><Text style={styles.reverseHoloBadgeText}>R</Text></View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {pageCount > 1 && (
          <>
            {pageIndex > 0 && (
              <Pressable onPress={() => goToPage(pageIndex - 1)} style={[styles.navBtn, styles.navBtnLeft]} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
            )}
            {pageIndex < pageCount - 1 && (
              <Pressable onPress={() => goToPage(pageIndex + 1)} style={[styles.navBtn, styles.navBtnRight]} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            )}
          </>
        )}
      </View>

      <CardZoomModal card={zoomTarget} onClose={() => setZoomTarget(null)} />
    </SafeAreaView>
  );
}
