import { useMemo, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pokeball } from './Pokeball';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import { useMotion } from '@/lib/motion';
import { withAlpha } from '@/lib/color-utils';

export type ToolTab = 'artists' | 'duplicates' | 'trainers' | 'duo' | 'tag';

// Hand-picked illustration crops (already landscape-composed, no card frame
// or attack text) — one per tab today, but the array is the point: dropping
// more files in here is all "alternance" (rotate a random pick per open)
// will ever need, no code change.
const TOOL_ART: Partial<Record<ToolTab, number[]>> = {
  duo: [require('../assets/tools/duo-1.png')],
  tag: [require('../assets/tools/tag-1.png')],
  trainers: [require('../assets/tools/trainers-1.png')],
};

// One steady pick per mount — `tab` is a fixed literal per call site, so this
// never reshuffles while the drawer stays open.
function useToolArt(tab: ToolTab): number | undefined {
  return useMemo(() => {
    const pool = TOOL_ART[tab];
    if (!pool || pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [tab]);
}

interface Props {
  /** Currently active tool subtab, if any — highlights the matching tile. */
  activeTab: ToolTab | null;
  onSelect: (tab: ToolTab) => void;
}

const DRAWER_WIDTH_RATIO = 0.78;
const DRAWER_MAX_WIDTH = 320;
const TAB_SIZE = 44;
// Fraction of the drawer's width a drag has to cross before release snaps it
// open instead of springing back closed — a binder-tab pull, not a toggle.
const OPEN_THRESHOLD = 0.35;

// Step 2 of the progressive Favoris redesign (step 1 was a plain button +
// bottom sheet, see git history) — a small Pokeball tab stuck to the right
// edge, styled like a binder page-divider, that the user pulls to reveal the
// curated-TCG-index tools (Duos/Tag/Dresseurs/Artistes/Doublons). The tab
// rides along the drawer panel's own leading edge (it's a child of the
// panel, offset to poke out past its left border), so one Animated.Value
// driving the panel's translateX moves both at once — no separate tab
// animation to keep in sync.
//
// Driven by RNGH's Gesture API but with React Native's built-in Animated
// (no reanimated in this project) — .setValue() during onUpdate applies
// immediately regardless of useNativeDriver, and the open/close snap uses
// Animated.spring like the rest of the app's motion (see tab-bar-visibility.tsx).
// A plain tap (no drag) toggles it too — a drag-only affordance would be
// both hard to discover and hard to perform precisely on every device.
export function CollectionToolsDrawer({ activeTab, onSelect }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const t = useT();
  const { animationsEnabled } = useMotion();

  const drawerWidth = Math.min(screenWidth * DRAWER_WIDTH_RATIO, DRAWER_MAX_WIDTH);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  // 0 (closed, panel fully off-screen right) .. drawerWidth (fully open).
  const progress = useRef(new Animated.Value(0)).current;
  const dragStartProgress = useRef(0);

  const animateTo = (isOpen: boolean) => {
    openRef.current = isOpen;
    setOpen(isOpen);
    const toValue = isOpen ? drawerWidth : 0;
    if (!animationsEnabled) { progress.setValue(toValue); return; }
    Animated.spring(progress, { toValue, useNativeDriver: true, bounciness: 4 }).start();
  };

  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => { dragStartProgress.current = openRef.current ? drawerWidth : 0; })
    .onUpdate((e) => {
      // Dragging left (negative translationX) pulls the drawer open.
      const next = Math.max(0, Math.min(drawerWidth, dragStartProgress.current - e.translationX));
      progress.setValue(next);
    })
    .onEnd((e) => {
      const current = dragStartProgress.current - e.translationX;
      animateTo(current > drawerWidth * OPEN_THRESHOLD);
    });

  const tapGesture = Gesture.Tap().onEnd(() => animateTo(!openRef.current));
  const tabGesture = Gesture.Race(tapGesture, panGesture);

  const translateX = progress.interpolate({ inputRange: [0, drawerWidth], outputRange: [drawerWidth, 0] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, drawerWidth], outputRange: [0, 0.45] });

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

  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    panel: {
      position: 'absolute' as const, top: '18%' as const, bottom: '10%' as const, right: 0,
      width: drawerWidth, backgroundColor: colors.surface,
      borderTopLeftRadius: radius.bubble, borderBottomLeftRadius: radius.bubble,
      ...shadow.md,
    },
    tab: {
      position: 'absolute' as const, top: '50%' as const, marginTop: -TAB_SIZE / 2, left: -TAB_SIZE * 0.6,
      width: TAB_SIZE, height: TAB_SIZE, borderRadius: TAB_SIZE / 2,
      backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const,
      ...shadow.md,
    },
    header: { padding: spacing.md, paddingBottom: spacing.sm },
    title: { fontSize: 15, fontFamily: fonts.display, color: colors.text },
    grid: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    },
    tile: {
      width: '47%' as const, aspectRatio: 1.5, borderRadius: radius.lg, overflow: 'hidden' as const,
      backgroundColor: colors.surfaceAlt, justifyContent: 'flex-end' as const,
    },
    tileActive: { borderWidth: 2, borderColor: colors.primary },
    tileImg: { position: 'absolute' as const, top: 0, left: 0, width: '100%' as const, height: '100%' as const },
    iconWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    tileLabelWrap: { padding: 6 },
    tileLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white' },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateTo(false)} accessibilityLabel={t('favorites.a11yCloseTools')} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <GestureDetector gesture={tabGesture}>
          <View
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={t(open ? 'favorites.a11yCloseTools' : 'favorites.a11yOpenTools')}>
            <Pokeball size={20} />
          </View>
        </GestureDetector>

        <View style={styles.header}>
          <Text style={styles.title}>{t('favorites.toolsSheetTitle')}</Text>
        </View>
        <View style={styles.grid}>
          {tiles.map(tile => (
            <Pressable
              key={tile.key}
              onPress={() => { onSelect(tile.key); animateTo(false); }}
              style={[styles.tile, activeTab === tile.key && styles.tileActive]}>
              {tile.art ? (
                <>
                  <Image source={tile.art} style={styles.tileImg} resizeMode="cover" />
                  <LinearGradient
                    colors={[withAlpha('#000000', 0), withAlpha('#000000', 0.75)]}
                    start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </>
              ) : tile.icon ? (
                <View style={styles.iconWrap}>
                  <Ionicons name={tile.icon} size={26} color={colors.textMuted} />
                </View>
              ) : null}
              <View style={styles.tileLabelWrap}>
                <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
