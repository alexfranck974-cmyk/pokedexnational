import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { ReadonlyCardGrid } from './ReadonlyCardGrid';
import { CardZoomModal } from './CardZoomModal';
import { RemoveWishFooterButton } from './CardCopySheet';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

export interface FriendSetGalleryTarget {
  setName: string;
  owned: number;
  total: number;
  cards: {
    key: string; imageSmall: string; imageLarge: string | null;
    /** Omit where price isn't relevant/available (e.g. a friend's public gallery) — ReadonlyCardGrid just skips the price line. */
    cardmarketLowEur?: number | null; cardmarketTrendEur?: number | null;
  }[];
  /** Wishlist galleries pass this to let a card be dropped straight from here
   * (grid thumbnail badge + zoomed-view footer) — read-only galleries (a
   * friend's public collection/wishlist) just omit it. */
  onRemoveCard?: (key: string) => void;
}

interface Props {
  target: FriendSetGalleryTarget | null;
  onClose: () => void;
}

export function FriendSetGalleryModal({ target, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [zoomed, setZoomed] = useState<{ key: string; image_small: string; image_large: string | null } | null>(null);
  const t = useT();
  useModalBackClose(target !== null, onClose);

  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, maxHeight: 680, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    headerText: { gap: 2 },
    title: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    subtitle: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
    close: { fontSize: 20, color: colors.textMuted },
    body: { flex: 1 },
  }));

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          {target && (
            <>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{target.setName}</Text>
                  <Text style={styles.subtitle}>{t('wishlist.cardsOfTotal', { owned: target.owned, total: target.total })}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.body}>
                <ReadonlyCardGrid
                  cards={target.cards.map(c => ({
                    key: c.key, image: c.imageSmall,
                    cardmarketLowEur: c.cardmarketLowEur, cardmarketTrendEur: c.cardmarketTrendEur,
                  }))}
                  onRemove={target.onRemoveCard}
                  onZoom={(key) => {
                    const card = target.cards.find(c => c.key === key);
                    if (card) setZoomed({ key, image_small: card.imageSmall, image_large: card.imageLarge });
                  }}
                />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
      <CardZoomModal
        card={zoomed}
        onClose={() => setZoomed(null)}
        footer={zoomed && target?.onRemoveCard ? (
          <RemoveWishFooterButton onPress={() => { target.onRemoveCard!(zoomed.key); setZoomed(null); }} />
        ) : undefined}
      />
    </Modal>
  );
}
