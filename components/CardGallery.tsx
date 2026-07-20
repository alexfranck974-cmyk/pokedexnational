import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { CardTile } from './CardTile';
import type { TcgCardRow } from '@/lib/tcg';

interface Props {
  cards: TcgCardRow[];
  ownedSet: Set<string>;
  wishedSet?: Set<string>;
  readOnly?: boolean;
  onToggle: (card: TcgCardRow) => void;
  onToggleWish?: (card: TcgCardRow) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, wishedSet, readOnly, onToggle, onToggleWish }: Props) {
  const { width } = useWindowDimensions();
  return (
    <FlashList
      data={cards}
      numColumns={numColsFor(width)}
      estimatedItemSize={200}
      keyExtractor={c => c.id}
      renderItem={({ item }) => (
        <CardTile
          card={item}
          owned={ownedSet.has(item.id)}
          wished={wishedSet?.has(item.id)}
          readOnly={readOnly}
          onToggle={() => onToggle(item)}
          onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
        />
      )}
    />
  );
}
