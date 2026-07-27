import { View, Image, StyleSheet } from 'react-native';
import { StatRingTile } from './StatRingTile';
import { useSetGoalProgress } from '@/lib/collection-goals';

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
  return (
    <View style={styles.wrap}>
      <StatRingTile label={setName} owned={owned} total={total} onPress={onPress} />
      {symbol && (
        <View style={styles.badge} pointerEvents="none">
          <Image source={{ uri: symbol }} style={styles.badgeImg} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: { position: 'absolute', top: 4, right: 12, width: 18, height: 18 },
  badgeImg: { width: '100%', height: '100%' },
});
