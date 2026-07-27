import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatRingTile } from './StatRingTile';
import { useSetGoalProgress } from '@/lib/collection-goals';
import { currentSetTier } from '@/lib/set-tiers';
import { useTheme } from '@/lib/theme';

interface Props {
  userId?: string;
  setId: string;
  setName: string;
  total: number;
  symbol?: string | null;
  onPress: () => void;
}

export function SetGoalTile({ userId, setId, setName, total, symbol, onPress }: Props) {
  const { data: owned = 0 } = useSetGoalProgress(userId, setId);
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const tier = currentSetTier(pct);
  return (
    <View style={styles.wrap}>
      <StatRingTile
        label={setName} owned={owned} total={total} onPress={onPress}
        color={tier?.color}
      />
      {symbol && (
        <View style={styles.badge} pointerEvents="none">
          <Image source={{ uri: symbol }} style={styles.badgeImg} resizeMode="contain" />
        </View>
      )}
      {tier && (
        <View style={[styles.trophy, { backgroundColor: colors.surface }]} pointerEvents="none">
          <Ionicons name="trophy" size={12} color={tier.color} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: { position: 'absolute', top: 4, right: 12, width: 18, height: 18 },
  badgeImg: { width: '100%', height: '100%' },
  trophy: {
    position: 'absolute', top: 4, left: 12, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
