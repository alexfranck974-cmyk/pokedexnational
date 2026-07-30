import { Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  refreshing: boolean;
  onRefresh: () => void;
  color?: string;
  size?: number;
}

// Explicit refresh affordance alongside the RefreshControl pull gesture — the
// gesture is a no-op under react-native-web (it renders a plain empty View,
// see node_modules/react-native-web/dist/exports/RefreshControl), so this is
// the only thing that actually does anything on web.
export function RefreshButton({ refreshing, onRefresh, color = 'white', size = 20 }: Props) {
  return (
    <Pressable onPress={onRefresh} disabled={refreshing} hitSlop={10}>
      {refreshing ? <ActivityIndicator size="small" color={color} /> : <Ionicons name="refresh" size={size} color={color} />}
    </Pressable>
  );
}
