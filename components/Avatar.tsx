import { View, Text } from 'react-native';
import { useTheme, fonts } from '@/lib/theme';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontFamily: fonts.display, color: colors.primary }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
