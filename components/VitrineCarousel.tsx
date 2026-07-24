import { useCallback, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface VitrineItem {
  key: string;
  image: string;
  onPress: () => void;
}

interface Props {
  title?: string;
  items: VitrineItem[];
}

const ITEM_WIDTH = 130;
const ITEM_ASPECT = 0.72;
// Negative gap makes neighbouring cards overlap like a fanned deck instead of
// sitting apart — the centred card still reads clearly thanks to scale/zIndex.
const GAP = -48;
const STRIDE = ITEM_WIDTH + GAP;

// Scale/opacity/lift/tilt ramp gradually across two neighbours on each side
// instead of snapping over a single stride — reads as a smooth continuous
// coverflow sweep as a card approaches the centre rather than a sudden pop.
const OFFSETS = [-2, -1, 0, 1, 2];
const SCALE_STEPS = [0.56, 0.78, 1.2, 0.78, 0.56];
const OPACITY_STEPS = [0.45, 0.75, 1, 0.75, 0.45];
const LIFT_STEPS = [6, 2, -8, 2, 6];
const ROTATE_STEPS = ['48deg', '26deg', '0deg', '-26deg', '-48deg'];

export function VitrineCarousel({ title = 'Vitrine', items }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const styles = useThemedStyles((colors, shadow) => ({
    wrap: { gap: spacing.sm, paddingVertical: spacing.md },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.monoBold, letterSpacing: 2, color: colors.textDim,
      textTransform: 'uppercase' as const, textAlign: 'center' as const,
    },
    card: {
      width: ITEM_WIDTH, aspectRatio: ITEM_ASPECT, borderRadius: radius.lg,
      backgroundColor: colors.surface, ...shadow.md,
    },
  }));

  const onLayout = useCallback((e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width), []);

  const updateActiveIndex = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / STRIDE);
    setActiveIndex(Math.max(0, Math.min(items.length - 1, idx)));
  }, [items.length]);

  if (items.length === 0) return null;
  const inset = Math.max(0, (containerWidth - ITEM_WIDTH) / 2);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Text style={styles.eyebrow}>{title}</Text>
      {containerWidth > 0 && (
        <Animated.FlatList
          data={items}
          horizontal
          keyExtractor={i => i.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={STRIDE}
          decelerationRate="normal"
          // Trailing padding compensates for the last card's own negative
          // marginRight, so it can still scroll to a fully centred rest position.
          contentContainerStyle={{ paddingLeft: inset, paddingRight: inset - GAP }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
            listener: updateActiveIndex,
          })}
          scrollEventThrottle={1}
          renderItem={({ item, index }) => {
            const center = index * STRIDE;
            const inputRange = OFFSETS.map(o => center + o * STRIDE);
            const scale = scrollX.interpolate({ inputRange, outputRange: SCALE_STEPS, extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: OPACITY_STEPS, extrapolate: 'clamp' });
            const translateY = scrollX.interpolate({ inputRange, outputRange: LIFT_STEPS, extrapolate: 'clamp' });
            const rotateY = scrollX.interpolate({ inputRange, outputRange: ROTATE_STEPS, extrapolate: 'clamp' });
            const zIndex = 100 - Math.min(99, Math.abs(index - activeIndex));
            return (
              <Pressable
                onPress={item.onPress}
                style={{ width: ITEM_WIDTH, marginRight: GAP, alignItems: 'center' as const, zIndex }}>
                <Animated.View style={{ transform: [{ perspective: 700 }, { rotateY }, { scale }, { translateY }], opacity }}>
                  <Image source={{ uri: item.image }} style={styles.card} resizeMode="contain" />
                </Animated.View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
