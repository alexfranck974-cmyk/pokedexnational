import type { ReactElement } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions, type RefreshControlProps } from 'react-native';
import { CardTile } from './CardTile';
import { CardListRow } from './CardListRow';
import type { TcgCardRow } from '@/lib/tcg';
import type { OwnedCardFinish } from '@/lib/collection';
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
  /** Required unless primaryAction="zoom" — see CardTile's identical prop. */
  onToggle?: (card: TcgCardRow) => void;
  onToggleWish?: (card: TcgCardRow) => void;
  onZoom?: (card: TcgCardRow) => void;
  primaryAction?: 'toggle' | 'zoom';
  /** Opens the per-finish (normale/holo/reverse) quantity + état editor for this card. */
  onOpenDetails?: (card: TcgCardRow) => void;
  /** Owned finishes per card id — when provided, tiles show a holo/reverse shimmer border. */
  finishesByCard?: Map<string, OwnedCardFinish[]>;
  /** Bulk-add mode — see CardTile/CardListRow. */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (card: TcgCardRow) => void;
  /** Wishlist-only actions — see CardTile/CardListRow's identical props. */
  priorityIds?: Set<string>;
  onTogglePriority?: (card: TcgCardRow) => void;
  priceAlertsByCard?: Map<string, number | null>;
  alertTriggeredIds?: Set<string>;
  onSetPriceAlert?: (card: TcgCardRow) => void;
  /** Pull-to-refresh — omit where the screen doesn't wire refresh (most callers). */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Extra bottom padding on top of the standard TAB_BAR_CLEARANCE — for a
   * screen with its own floating toolbar overlaying the bottom of the list
   * (e.g. pinned-set/[setId].tsx), so the last row doesn't render underneath
   * it. Omit to keep the standard clearance only. */
  extraBottomInset?: number;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, wishedSet, dexCardId, readOnly, viewMode = 'grid', columnsOverride, quantities, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails, finishesByCard, selectionMode, selectedIds, onToggleSelect, priorityIds, onTogglePriority, priceAlertsByCard, alertTriggeredIds, onSetPriceAlert, primaryAction, refreshControl, extraBottomInset }: Props) {
  const { width } = useWindowDimensions();
  const hideOnScrollProps = useHideOnScrollProps();
  const bottomPadding = TAB_BAR_CLEARANCE + (extraBottomInset ?? 0);
  if (viewMode === 'list') {
    return (
      <FlashList
        data={cards}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        maintainVisibleContentPosition={{ disabled: true }}
        keyExtractor={c => c.id}
        refreshControl={refreshControl}
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
            onToggle={onToggle ? () => onToggle(item) : undefined}
            primaryAction={primaryAction}
            onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
            onZoom={onZoom ? () => onZoom(item) : undefined}
            onOpenDetails={onOpenDetails ? () => onOpenDetails(item) : undefined}
            finishes={finishesByCard?.get(item.id)}
            selectionMode={selectionMode}
            selected={selectedIds?.has(item.id)}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(item) : undefined}
            isPriority={priorityIds?.has(item.id)}
            onTogglePriority={onTogglePriority ? () => onTogglePriority(item) : undefined}
            hasPriceAlert={priceAlertsByCard?.get(item.id) != null}
            alertTriggered={alertTriggeredIds?.has(item.id)}
            onSetPriceAlert={onSetPriceAlert ? () => onSetPriceAlert(item) : undefined}
          />
        )}
      />
    );
  }
  return (
    <FlashList
      data={cards}
      numColumns={columnsOverride ?? numColsFor(width)}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      maintainVisibleContentPosition={{ disabled: true }}
      keyExtractor={c => c.id}
      refreshControl={refreshControl}
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
          onToggle={onToggle ? () => onToggle(item) : undefined}
          primaryAction={primaryAction}
          onToggleWish={onToggleWish ? () => onToggleWish(item) : undefined}
          onZoom={onZoom ? () => onZoom(item) : undefined}
          onOpenDetails={onOpenDetails ? () => onOpenDetails(item) : undefined}
          finishes={finishesByCard?.get(item.id)}
          selectionMode={selectionMode}
          selected={selectedIds?.has(item.id)}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(item) : undefined}
          isPriority={priorityIds?.has(item.id)}
          onTogglePriority={onTogglePriority ? () => onTogglePriority(item) : undefined}
          hasPriceAlert={priceAlertsByCard?.get(item.id) != null}
          alertTriggered={alertTriggeredIds?.has(item.id)}
          onSetPriceAlert={onSetPriceAlert ? () => onSetPriceAlert(item) : undefined}
        />
      )}
    />
  );
}
