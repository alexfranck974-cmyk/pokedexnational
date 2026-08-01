import { View, Text, Image, FlatList } from 'react-native';
import { useCompletedTradeOffers, type CompletedTradeItem } from '@/lib/trades';
import { BubbleSheet } from './BubbleSheet';
import { TradeIcon } from './TradeIcon';
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

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Opened from the Dashboard "Échanges" ring — a log of trades actually
// completed (both sides confirmed), not a management view. Pending offers
// and in-progress exchanges already have their own dedicated spots (the
// Marché tab and the spinning-Pokéball FAB in app/(app)/_layout.tsx).
export function TradeHistoryModal({ userId, visible, onClose }: Props) {
  const { data: history = [] } = useCompletedTradeOffers(userId);

  const styles = useThemedStyles((colors, shadow) => ({
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.xl, textAlign: 'center' as const },
    list: { padding: spacing.md, gap: spacing.sm },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    rowInfo: { flex: 1, gap: 1 },
    text: { fontSize: 13, fontFamily: fonts.body, color: colors.text },
    textBold: { fontFamily: fonts.bodyBold },
    date: { fontSize: 11, fontFamily: fonts.mono, color: colors.textDim },
    thumbs: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
    thumb: { width: 28, height: 28 / 0.72, borderRadius: 3 },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={TINT} title="Historique des échanges">
      {history.length === 0 ? (
        <Text style={styles.empty}>Aucun échange finalisé pour l’instant.</Text>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(t: CompletedTradeItem) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: t }) => (
            <View style={styles.row}>
              <Avatar name={t.counterpartyName} />
              <View style={styles.rowInfo}>
                <Text style={styles.text}>
                  Échange avec <Text style={styles.textBold}>{t.counterpartyName}</Text>
                </Text>
                <Text style={styles.date}>{dateFormatter.format(new Date(t.completedAt))}</Text>
              </View>
              <View style={styles.thumbs}>
                <Image source={{ uri: t.gaveCard.imageSmall }} style={styles.thumb} resizeMode="contain" />
                <TradeIcon size={12} color={TINT} />
                <Image source={{ uri: t.receivedCard.imageSmall }} style={styles.thumb} resizeMode="contain" />
              </View>
            </View>
          )}
        />
      )}
    </BubbleSheet>
  );
}
