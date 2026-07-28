import { useMemo } from 'react';
import { Modal, Image, Text, View, PanResponder, useWindowDimensions } from 'react-native';
import { useThemedStyles, fonts, spacing } from '@/lib/theme';
import { useModalBackClose } from '@/lib/useModalBackClose';

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
      marginTop: spacing.sm, fontSize: 17, fontFamily: fonts.display, color: 'white',
      textAlign: 'center' as const, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6,
    },
  }));

  // Keyed on isOpen (not `card` itself) so browsing between cards via swipe
  // doesn't push/pop a history entry per card.
  const isOpen = card !== null;
  useModalBackClose(isOpen, onClose);

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
  // Fit tightly to the standard TCG card ratio instead of a fixed box — a
  // fixed height left letterbox slack around the (narrower) card art, which
  // pushed the caption well below the card's actual visible bottom edge.
  const CARD_RATIO = 0.72;
  let renderW = maxW;
  let renderH = renderW / CARD_RATIO;
  if (renderH > maxH) { renderH = maxH; renderW = renderH * CARD_RATIO; }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} {...pan.panHandlers}>
        <Image
          source={{ uri: src }}
          style={{ width: renderW, height: renderH }}
          resizeMode="contain"
        />
        {caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
    </Modal>
  );
}
