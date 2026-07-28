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
  /** Overrides the width-based default column count in grid mode. */
  columnsOverride?: 3 | 4 | null;
  /** Copies owned per card id — when provided (alongside onIncrement/onDecrement), tiles show a +/- stepper instead of a plain owned badge. */
  quantities?: Map<string, number>;
  onIncrement?: (card: TcgCardRow) => void;
  onDecrement?: (card: TcgCardRow) => void;
  onToggle: (card: TcgCardRow) => void;
  onToggleWish?: (card: TcgCardRow) => void;
  onZoom?: (card: TcgCardRow) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, wishedSet, readOnly, viewMode = 'grid', columnsOverride, quantities, onIncrement, onDecrement, onToggle, onToggleWish, onZoom }: Props) {
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
            quantity={quantities?.get(item.id)}
            onIncrement={onIncrement ? () => onIncrement(item) : undefined}
            onDecrement={onDecrement ? () => onDecrement(item) : undefined}
            onToggle={() => onToggle(item)}
            onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
            onZoom={onZoom ? () => onZoom(item) : undefined}
          />
        )}
      />
    );
  }
  return (
    <FlashList
      data={cards}
      numColumns={columnsOverride ?? numColsFor(width)}
      estimatedItemSize={200}
      keyExtractor={c => c.id}
      renderItem={({ item }) => (
        <CardTile
          card={item}
          owned={ownedSet.has(item.id)}
          wished={wishedSet?.has(item.id)}
          readOnly={readOnly}
          quantity={quantities?.get(item.id)}
          onIncrement={onIncrement ? () => onIncrement(item) : undefined}
          onDecrement={onDecrement ? () => onDecrement(item) : undefined}
          onToggle={() => onToggle(item)}
          onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
          onZoom={onZoom ? () => onZoom(item) : undefined}
        />
      )}
    />
  );
}
