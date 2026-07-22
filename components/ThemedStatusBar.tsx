import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/lib/theme';

export function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}
