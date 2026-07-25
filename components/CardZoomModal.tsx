import { useMemo } from 'react';
import { Modal, Image, Text, View, PanResponder, useWindowDimensions } from 'react-native';
import { useThemedStyles, fonts, spacing } from '@/lib/theme';

export interface ZoomableCard {
  image_small: string;
  image_large?: string | null;
}

interface Props {
  card: ZoomableCard | null;
  caption?: string;
  onClose: () => void;
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
}

const SWIPE_THRESHOLD = 50;
const TAP_TOLERANCE = 8;

export function CardZoomModal({ card, caption, onClose, onSwipeNext, onSwipePrev }: Props) {
  const { width, height } = useWindowDimensions();
  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center' as const, justifyContent: 'center' as const },
    caption: {
      marginTop: spacing.md, fontSize: 17, fontFamily: fonts.display, color: 'white',
      textAlign: 'center' as const, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6,
    },
  }));

  // Single responder handles both tap-to-close and swipe-to-browse — claiming it
  // on the same gesture avoids a nested Pressable racing a child PanResponder
  // (which let a swipe get misread as a tap that closed the modal).
  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_THRESHOLD && onSwipeNext) onSwipeNext();
        else if (g.dx >= SWIPE_THRESHOLD && onSwipePrev) onSwipePrev();
        else if (Math.abs(g.dx) < TAP_TOLERANCE && Math.abs(g.dy) < TAP_TOLERANCE) onClose();
      },
    }),
    [onClose, onSwipeNext, onSwipePrev],
  );

  if (!card) return null;
  const src = card.image_large ?? card.image_small;
  const maxW = Math.min(width * 0.9, 500);
  const maxH = Math.min(height * 0.78, 650);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} {...pan.panHandlers}>
        <Image
          source={{ uri: src }}
          style={{ width: maxW, height: maxH }}
          resizeMode="contain"
        />
        {caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
    </Modal>
  );
}
