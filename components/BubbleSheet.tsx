import type { ReactNode } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Seam color + tinted accent, matching the Bubble that opened this sheet. */
  tint: string;
  /** Header row (title + ✕). Omit for bespoke content that provides its own close affordance (e.g. BadgeDetailModal's "Fermer" button). */
  title?: string;
  /**
   * 'standard' (default) caps height so scrollable content works (85% mobile,
   * 480×680 desktop). 'auto' hugs short, fixed content with no height cap
   * (mobile) / no height cap at 400px wide (desktop) — for content that
   * would otherwise leave awkward empty space under a tall sheet.
   */
  sizing?: 'standard' | 'auto';
  /** 'standard' sizing only: fixed desktop height instead of maxHeight — keeps a search/filter panel a stable size as result counts change instead of resizing per keystroke. */
  desktopFixedHeight?: number;
  children: ReactNode;
}

export function BubbleSheet({ visible, onClose, tint, title, sizing = 'standard', desktopFixedHeight, children }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: {
      width: '100%' as const, backgroundColor: colors.surface,
      borderTopLeftRadius: radius.bubble, borderTopRightRadius: radius.bubble,
      overflow: 'hidden' as const,
    },
    seam: { height: 4, backgroundColor: tint },
    header: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    title: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
  }));

  const mobileSize = sizing === 'standard' ? { maxHeight: '85%' as const } : null;
  const desktopSize = isDesktop
    ? sizing === 'standard'
      ? { width: 480, borderRadius: radius.bubble, marginBottom: spacing.xl + spacing.md, ...(desktopFixedHeight ? { height: desktopFixedHeight } : { maxHeight: 680 }) }
      : { width: 400, borderRadius: radius.bubble, marginBottom: spacing.xl + spacing.md }
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, mobileSize, desktopSize]} onPress={() => {}}>
          <View style={styles.seam} />
          {title && (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
