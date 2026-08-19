import { useState } from 'react';
import { ScrollView } from 'react-native';
import type { ComputedBadge } from '@/lib/badges';
import { AchievementBadge } from './AchievementBadge';
import { BadgeDetailModal, type BadgeDetailTarget } from './BadgeDetailModal';
import { BubbleSheet } from './BubbleSheet';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useThemedStyles, spacing } from '@/lib/theme';
import { useT } from '@/lib/locale';

interface Props {
  visible: boolean;
  badges: ComputedBadge[];
  tint: string;
  onClose: () => void;
}

export function AllBadgesModal({ visible, badges, tint, onClose }: Props) {
  const [badgeDetail, setBadgeDetail] = useState<BadgeDetailTarget | null>(null);
  const t = useT();
  useModalBackClose(visible, onClose);

  const styles = useThemedStyles(() => ({
    body: { padding: spacing.md, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  }));

  return (
    <>
      <BubbleSheet visible={visible} onClose={onClose} tint={tint} title={t('allBadges.title', { n: badges.length })}>
        <ScrollView contentContainerStyle={styles.body}>
          {badges.map(b => (
            <AchievementBadge
              key={b.id}
              icon={b.icon}
              iconUri={b.iconUri}
              label={b.label}
              unlocked={b.unlockedNow}
              onPress={() => setBadgeDetail({ icon: b.icon, iconUri: b.iconUri, label: b.label, description: b.description, unlocked: b.unlockedNow })}
            />
          ))}
        </ScrollView>
      </BubbleSheet>
      <BadgeDetailModal target={badgeDetail} tint={tint} onClose={() => setBadgeDetail(null)} />
    </>
  );
}
