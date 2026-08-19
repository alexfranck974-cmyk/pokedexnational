import type { StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useT } from '@/lib/locale';
import { useTheme } from '@/lib/theme';

interface Props {
  onPress?: () => void;
  color?: string;
  size?: number;
  /** Shows the translated "Retour"/"Back" text next to the chevron. Default false (icon-only). */
  label?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// accessibilityLabel is always set regardless of `label` — icon-only call
// sites (legal pages, favorites Teams editor, TrainersPanel, BinderSlotPicker)
// get a real name for screen readers without any visual change.
export function BackButton({ onPress, color, size = 22, label = false, style, textStyle }: Props) {
  const router = useRouter();
  const t = useT();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={8}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}>
      <Ionicons name="chevron-back" size={size} color={color ?? colors.primary} />
      {label && <Text style={textStyle}>{t('common.back')}</Text>}
    </Pressable>
  );
}
