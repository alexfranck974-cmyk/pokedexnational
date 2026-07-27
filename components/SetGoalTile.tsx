import { StatRingTile } from './StatRingTile';
import { useSetGoalProgress } from '@/lib/collection-goals';

interface Props {
  userId?: string;
  setId: string;
  setName: string;
  total: number;
  onPress: () => void;
}

export function SetGoalTile({ userId, setId, setName, total, onPress }: Props) {
  const { data: owned = 0 } = useSetGoalProgress(userId, setId);
  return <StatRingTile label={setName} owned={owned} total={total} onPress={onPress} />;
}
