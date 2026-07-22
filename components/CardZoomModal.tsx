import { Modal, Pressable, Image, useWindowDimensions } from 'react-native';
import { useThemedStyles } from '@/lib/theme';

export interface ZoomableCard {
  image_small: string;
  image_large?: string | null;
}

interface Props {
  card: ZoomableCard | null;
  onClose: () => void;
}

export function CardZoomModal({ card, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center' as const, justifyContent: 'center' as const },
  }));
  if (!card) return null;
  const src = card.image_large ?? card.image_small;
  const maxW = Math.min(width * 0.9, 500);
  const maxH = Math.min(height * 0.85, 700);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Image
          source={{ uri: src }}
          style={{ width: maxW, height: maxH }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}
