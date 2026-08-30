import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatRingTile } from './StatRingTile';
import { useSetGoalProgress } from '@/lib/collection-goals';
import { currentSetTier } from '@/lib/set-tiers';
import { useTheme } from '@/lib/theme';
import { postSetGoalCompletedNewsIfNotable } from '@/lib/friend-news';

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

  // Same "genuine incomplete->complete transition, never on first sight"
  // reasoning as the binder-completion celebration (favorites.tsx) — undefined
  // means unknown, not "was incomplete", so an already-100% set doesn't post
  // the moment its tile first mounts. postSetGoalCompletedNewsIfNotable is
  // also its own idempotency guard (existence check before insert).
  const completeSeenRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const isComplete = total > 0 && pct >= 100;
    const prev = completeSeenRef.current;
    completeSeenRef.current = isComplete;
    if (prev === undefined) return;
    if (isComplete && !prev && userId) postSetGoalCompletedNewsIfNotable(userId, setId, setName);
  }, [pct, total, userId, setId, setName]);

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
  ringIcon: { width: RING_SIZE * 0.4, height: RING_SIZE * 0.4 },
  trophy: {
    position: 'absolute', top: 4, left: 12, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
