import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatRingTile } from './StatRingTile';
import { useSetGoalProgress } from '@/lib/collection-goals';
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
  const complete = total > 0 && owned >= total;
  return (
    <View style={styles.wrap}>
      <StatRingTile
        label={setName} owned={owned} total={total} onPress={onPress}
        color={complete ? colors.warning : undefined}
      />
      {symbol && (
        <View style={styles.badge} pointerEvents="none">
          <Image source={{ uri: symbol }} style={styles.badgeImg} resizeMode="contain" />
        </View>
      )}
      {complete && (
        <View style={[styles.trophy, { backgroundColor: colors.surface }]} pointerEvents="none">
          <Ionicons name="trophy" size={12} color={colors.warning} />
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
