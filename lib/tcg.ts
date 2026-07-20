import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface TcgCardRow {
  id: string;
  name: string;
  set_id: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_small: string;
  image_large: string | null;
  release_date: string | null;
  series: string | null;
}

export function useCardsForPokemon(dexNum: number | undefined) {
  return useQuery({
    queryKey: ['tcg_cards_by_dex', dexNum],
    enabled: !!dexNum,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, set_id, set_name, card_number, rarity, image_small, image_large, release_date, series')
        .eq('dex_num', dexNum!)
        .order('release_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TcgCardRow[];
    },
  });
}
