import { type ReactElement } from 'react';
import { type RefreshControlProps } from 'react-native';
import { DexCardPanel } from './DexCardPanel';
import { useTagTeamCards } from '@/lib/tcg';
import { useT } from '@/lib/locale';

interface Props {
  userId?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

// Favoris subtab wrapper — see DexCardPanel for the shared UI and
// useTagTeamCards for what actually qualifies a card.
export function TagTeamPanel({ userId, refreshControl }: Props) {
  const t = useT();
  const { data: cards = [], isLoading: cardsLoading } = useTagTeamCards();
  return (
    <DexCardPanel
      cards={cards}
      cardsLoading={cardsLoading}
      userId={userId}
      refreshControl={refreshControl}
      countLabel={n => t(n > 1 ? 'tagTeamCards.countPlural' : 'tagTeamCards.countSingular', { n })}
      cardsCountLabel={n => t(n > 1 ? 'tagTeamCards.cardsCountPlural' : 'tagTeamCards.cardsCountSingular', { n })}
      searchPlaceholder={t('tagTeamCards.searchPlaceholder')}
      notFoundLabel={t('tagTeamCards.notFound')}
    />
  );
}
