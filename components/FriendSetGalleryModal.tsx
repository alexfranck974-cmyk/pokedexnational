import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ReadonlyCardGrid } from './ReadonlyCardGrid';
import { CardZoomModal } from './CardZoomModal';
import { RemoveWishFooterButton } from './CardCopySheet';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useBackdropDepth } from '@/lib/modal-backdrop';
import { withReturnTo } from '@/lib/navigation';
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
    /** TCG set this printing belongs to — only meaningful when this gallery
     * groups cards *by Pokémon* (several different sets mixed together, e.g.
     * the wishlist). Omit when it groups cards *by set* instead (the set is
     * already the screen you're on — a link back to it would be redundant). */
    setId?: string; setLabel?: string;
  }[];
  /** Wishlist galleries pass this to let a card be dropped straight from here
   * (grid thumbnail badge + zoomed-view footer) — read-only galleries (a
   * friend's public collection/wishlist) just omit it. */
  onRemoveCard?: (key: string) => void;
  /** Screen this gallery was opened from — only meaningful alongside a card's
   * `setId`/`setLabel` above, so the extension screen's "Retour" chain leads
   * back here instead of falling through to its hardcoded default. */
  returnTo?: string;
}

interface Props {
  target: FriendSetGalleryTarget | null;
  onClose: () => void;
}

export function FriendSetGalleryModal({ target, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  // Keyed on the card's id, not a stored snapshot — same reasoning as
  // wishlist.tsx's own `gallery`/`zoomedCard` derivation: stays in sync if
  // the underlying data changes while zoomed instead of showing stale props.
  const [zoomedKey, setZoomedKey] = useState<string | null>(null);
  const zoomed = zoomedKey != null ? target?.cards.find(c => c.key === zoomedKey) ?? null : null;
  const t = useT();
  const router = useRouter();
  useModalBackClose(target !== null, onClose);
  const hasBackdropBeneath = useBackdropDepth(target !== null);

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
      <Pressable style={[styles.backdrop, hasBackdropBeneath && { backgroundColor: 'transparent' }]} onPress={onClose}>
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
                  onZoom={(key) => setZoomedKey(key)}
                />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
      <CardZoomModal
        card={zoomed ? { image_small: zoomed.imageSmall, image_large: zoomed.imageLarge } : null}
        setLabel={zoomed?.setLabel}
        onOpenSet={zoomed?.setId ? () => {
          const setId = zoomed.setId!;
          setZoomedKey(null);
          onClose();
          const href = target?.returnTo ? withReturnTo(`/pinned-set/${setId}`, target.returnTo) : `/pinned-set/${setId}`;
          router.push(href as never);
        } : undefined}
        onClose={() => setZoomedKey(null)}
        footer={zoomed && target?.onRemoveCard ? (
          <RemoveWishFooterButton onPress={() => { target.onRemoveCard!(zoomed.key); setZoomedKey(null); }} />
        ) : undefined}
      />
    </Modal>
  );
}
