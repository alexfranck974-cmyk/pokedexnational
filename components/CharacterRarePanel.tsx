import { type ReactElement } from 'react';
import { type RefreshControlProps } from 'react-native';
import { DexCardPanel } from './DexCardPanel';
import { useCharacterRareCards } from '@/lib/tcg';
import { useT } from '@/lib/locale';

interface Props {
  userId?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

// Favoris subtab wrapper — see DexCardPanel for the shared UI and
// useCharacterRareCards for what actually qualifies a card.
export function CharacterRarePanel({ userId, refreshControl }: Props) {
  const t = useT();
  const { data: cards = [], isLoading: cardsLoading } = useCharacterRareCards();
  return (
    <DexCardPanel
      cards={cards}
      cardsLoading={cardsLoading}
      userId={userId}
      refreshControl={refreshControl}
      countLabel={n => t(n > 1 ? 'duoCards.countPlural' : 'duoCards.countSingular', { n })}
      cardsCountLabel={n => t(n > 1 ? 'duoCards.cardsCountPlural' : 'duoCards.cardsCountSingular', { n })}
      searchPlaceholder={t('duoCards.searchPlaceholder')}
      notFoundLabel={t('duoCards.notFound')}
    />
  );
}
