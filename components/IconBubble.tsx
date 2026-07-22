import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  color: string;
  children: ReactNode;
}

export function IconBubble({ size = 44, color, children }: Props) {
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { alignItems: 'center', justifyContent: 'center' },
});
