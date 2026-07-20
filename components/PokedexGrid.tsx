import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';

interface Props {
  items: PokemonWithState[];
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  onSelect: (num: number) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

export function PokedexGrid({ items, ownedImages, wishedInDexSet, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const cols = numColsFor(width);
  return (
    <FlashList
      data={items}
      numColumns={cols}
      estimatedItemSize={120}
      keyExtractor={item => String(item.num)}
      renderItem={({ item }) => (
        <PokemonTile
          pokemon={item}
          owned={item.owned}
          ownedCardImage={ownedImages?.get(item.num)}
          wishedInDex={wishedInDexSet?.has(item.num)}
          onPress={() => onSelect(item.num)}
        />
      )}
    />
  );
}
