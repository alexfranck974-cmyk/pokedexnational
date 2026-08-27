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
  onUnpin?: () => void;
}

// Ring size for pinned-goal tiles — bigger than StatRingTile's own default
// (64) since the set symbol now sits inside the ring itself (was a small
// top-right corner badge before) and needs room to actually read.
const RING_SIZE = 84;

export function SetGoalTile({ userId, setId, setName, total, symbol, onPress, onUnpin }: Props) {
  const { data: owned = 0 } = useSetGoalProgress(userId, setId);
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const tier = currentSetTier(pct);
  return (
    <View style={styles.wrap}>
      <StatRingTile
        label={setName} owned={owned} total={total} onPress={onPress} onLongPress={onUnpin}
        color={tier?.color} size={RING_SIZE}
        icon={symbol ? <Image source={{ uri: symbol }} style={styles.ringIcon} resizeMode="contain" /> : undefined}
      />
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
  ringIcon: { width: RING_SIZE * 0.5, height: RING_SIZE * 0.5 },
  trophy: {
    position: 'absolute', top: 4, left: 12, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
