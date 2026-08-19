import { View, Text } from 'react-native';
import { getStatusLabel, type FeedbackStatus } from '@/lib/feedback';
import { useTheme, radius, fonts } from '@/lib/theme';
import { useLocale } from '@/lib/locale';

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const tint = {
    open: colors.primary,
    in_progress: colors.warning,
    resolved: colors.success,
    closed: colors.textDim,
  }[status];
  return (
    <View style={{ backgroundColor: `${tint}22`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: tint }}>{getStatusLabel(status, locale)}</Text>
    </View>
  );
}
