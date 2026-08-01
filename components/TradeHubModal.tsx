import { useState } from 'react';
import { View, Text, Image, Pressable, FlatList } from 'react-native';
import { usePendingTradeOffers, useInProgressTradeOffers, type TradeOfferItem, type TradeInProgressItem } from '@/lib/trades';
import { TradeOfferPopup } from './TradeOfferPopup';
import { TradeInProgressPopup } from './TradeInProgressPopup';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  userId?: string;
  visible: boolean;
  onClose: () => void;
}

const TINT = '#2dd4bf';

function Avatar({ name }: { name: string }) {
  const styles = useThemedStyles((colors) => ({
    wrap: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    text: { fontSize: 14, fontFamily: fonts.display, color: colors.primary },
  }));
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Opened from the Dashboard "Échanges" ring — the full pending-offers list,
// same rows/behavior as the "Échanges" section in Amis (friends.tsx), just in
// its own sheet so the ring behaves like its siblings (Collection/Badges/Achats
// each open their own modal rather than navigating away).
export function TradeHubModal({ userId, visible, onClose }: Props) {
  const { data: tradeOffers = [] } = usePendingTradeOffers(userId);
  const { data: inProgressOffers = [] } = useInProgressTradeOffers(userId);
  const [openTrade, setOpenTrade] = useState<TradeOfferItem | null>(null);
  const [openInProgress, setOpenInProgress] = useState<TradeInProgressItem | null>(null);

  const styles = useThemedStyles((colors, shadow) => ({
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.xl, textAlign: 'center' as const },
    list: { padding: spacing.md, gap: spacing.sm },
    sectionLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, marginTop: spacing.sm, marginBottom: -spacing.xs },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    rowInfo: { flex: 1, gap: 1 },
    text: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    textMuted: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim },
    textBold: { fontFamily: fonts.bodyBold },
    thumb: { width: 28, height: 28 / 0.72, borderRadius: 3 },
  }));

  return (
    <>
      <BubbleSheet visible={visible} onClose={onClose} tint={TINT} title="Échanges">
        {tradeOffers.length === 0 && inProgressOffers.length === 0 ? (
          <Text style={styles.empty}>Aucun échange en cours — propose un doublon à un ami depuis Amis.</Text>
        ) : (
          <FlatList
            data={[
              ...(inProgressOffers.length > 0 ? [{ kind: 'in_progress_label' as const }] : []),
              ...inProgressOffers.map(t => ({ kind: 'in_progress' as const, t })),
              ...(tradeOffers.length > 0 ? [{ kind: 'pending_label' as const }] : []),
              ...tradeOffers.map(t => ({ kind: 'pending' as const, t })),
            ]}
            keyExtractor={(row, i) => (row.kind === 'in_progress_label' || row.kind === 'pending_label') ? row.kind : row.t.id + i}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => {
              if (row.kind === 'in_progress_label') return <Text style={styles.sectionLabel}>En cours</Text>;
              if (row.kind === 'pending_label') return <Text style={styles.sectionLabel}>Propositions</Text>;
              if (row.kind === 'in_progress') {
                const t = row.t;
                return (
                  <Pressable onPress={() => setOpenInProgress(t)} style={styles.row}>
                    <Avatar name={t.counterpartyName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.text}>Échange avec <Text style={styles.textBold}>{t.counterpartyName}</Text></Text>
                      <Text style={styles.textMuted}>{t.myConfirmed ? `En attente de ${t.counterpartyName}` : 'À confirmer de ton côté'}</Text>
                    </View>
                    <Image
                      source={{ uri: t.direction === 'incoming' ? t.offeredCard.imageSmall : t.requestedCard.imageSmall }}
                      style={styles.thumb} resizeMode="contain"
                    />
                  </Pressable>
                );
              }
              const t = row.t;
              return (
                <Pressable onPress={() => setOpenTrade(t)} style={styles.row}>
                  <Avatar name={t.counterpartyName} />
                  <Text style={styles.text}>
                    {t.direction === 'incoming' ? (
                      <><Text style={styles.textBold}>{t.counterpartyName}</Text> te propose un échange</>
                    ) : (
                      <>En attente de <Text style={styles.textBold}>{t.counterpartyName}</Text></>
                    )}
                  </Text>
                  <Image
                    source={{ uri: t.direction === 'incoming' ? t.offeredCard.imageSmall : t.requestedCard.imageSmall }}
                    style={styles.thumb} resizeMode="contain"
                  />
                </Pressable>
              );
            }}
          />
        )}
      </BubbleSheet>
      <TradeOfferPopup item={openTrade} onClose={() => setOpenTrade(null)} />
      <TradeInProgressPopup item={openInProgress} onClose={() => setOpenInProgress(null)} />
    </>
  );
}
