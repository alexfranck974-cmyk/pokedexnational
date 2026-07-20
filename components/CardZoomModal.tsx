import { Modal, Pressable, Image, StyleSheet, useWindowDimensions } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';
import { colors } from '@/lib/theme';

interface Props {
  card: TcgCardRow | null;
  onClose: () => void;
}

export function CardZoomModal({ card, onClose }: Props) {
  const { width, height } = useWindowDimensions();
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center', justifyContent: 'center' },
});
