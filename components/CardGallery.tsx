import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { CardTile } from './CardTile';
import { CardListRow } from './CardListRow';
import type { TcgCardRow } from '@/lib/tcg';
import { TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';

interface Props {
  cards: TcgCardRow[];
  ownedSet: Set<string>;
  wishedSet?: Set<string>;
  /** The one printing (if any) chosen to represent this Pokémon in the National
   * Dex — draws a gold halo on that specific tile among several owned printings
   * of the same Pokémon. Only meaningful when `cards` are all for one dex_num
   * (the Pokémon detail screen); omit elsewhere. */
  dexCardId?: string;
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
  /** Opens the per-finish (normale/holo/reverse) quantity + état editor for this card. */
  onOpenDetails?: (card: TcgCardRow) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, wishedSet, dexCardId, readOnly, viewMode = 'grid', columnsOverride, quantities, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails }: Props) {
  const { width } = useWindowDimensions();
  const hideOnScrollProps = useHideOnScrollProps();
  if (viewMode === 'list') {
    return (
      <FlashList
        data={cards}
        estimatedItemSize={100}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        maintainVisibleContentPosition={{ disabled: true }}
        keyExtractor={c => c.id}
        {...hideOnScrollProps}
        renderItem={({ item }) => !item ? null : (
          <CardListRow
            card={item}
            owned={ownedSet.has(item.id)}
            wished={wishedSet?.has(item.id)}
            isDexCard={item.id === dexCardId}
            readOnly={readOnly}
            quantity={quantities?.get(item.id)}
            onIncrement={onIncrement ? () => onIncrement(item) : undefined}
            onDecrement={onDecrement ? () => onDecrement(item) : undefined}
            onToggle={() => onToggle(item)}
            onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
            onZoom={onZoom ? () => onZoom(item) : undefined}
            onOpenDetails={onOpenDetails ? () => onOpenDetails(item) : undefined}
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
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      maintainVisibleContentPosition={{ disabled: true }}
      keyExtractor={c => c.id}
      {...hideOnScrollProps}
      renderItem={({ item }) => !item ? null : (
        <CardTile
          card={item}
          owned={ownedSet.has(item.id)}
          wished={wishedSet?.has(item.id)}
          isDexCard={item.id === dexCardId}
          readOnly={readOnly}
          quantity={quantities?.get(item.id)}
          onIncrement={onIncrement ? () => onIncrement(item) : undefined}
          onDecrement={onDecrement ? () => onDecrement(item) : undefined}
          onToggle={() => onToggle(item)}
          onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
          onZoom={onZoom ? () => onZoom(item) : undefined}
          onOpenDetails={onOpenDetails ? () => onOpenDetails(item) : undefined}
        />
      )}
    />
  );
}
