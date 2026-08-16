import { View, Text } from 'react-native';
import { type FeedbackStatus } from '@/lib/feedback';
import { useTheme, radius, fonts } from '@/lib/theme';

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const { colors } = useTheme();
  const tint = {
    open: colors.primary,
    in_progress: colors.warning,
    resolved: colors.success,
    closed: colors.textDim,
  }[status];
  return (
    <View style={{ backgroundColor: `${tint}22`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: tint }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}
