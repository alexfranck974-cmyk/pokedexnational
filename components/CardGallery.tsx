import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { CardTile } from './CardTile';
import { CardListRow } from './CardListRow';
import type { TcgCardRow } from '@/lib/tcg';

interface Props {
  cards: TcgCardRow[];
  ownedSet: Set<string>;
  wishedSet?: Set<string>;
  readOnly?: boolean;
  viewMode?: 'grid' | 'list';
  onToggle: (card: TcgCardRow) => void;
  onToggleWish?: (card: TcgCardRow) => void;
  onLongPress?: (card: TcgCardRow) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, wishedSet, readOnly, viewMode = 'grid', onToggle, onToggleWish, onLongPress }: Props) {
  const { width } = useWindowDimensions();
  if (viewMode === 'list') {
    return (
      <FlashList
        data={cards}
        estimatedItemSize={100}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <CardListRow
            card={item}
            owned={ownedSet.has(item.id)}
            wished={wishedSet?.has(item.id)}
            readOnly={readOnly}
            onToggle={() => onToggle(item)}
            onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
            onLongPress={onLongPress ? () => onLongPress(item) : undefined}
          />
        )}
      />
    );
  }
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
          onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        />
      )}
    />
  );
}
