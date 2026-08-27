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
  region: 'global' | 'jp' | 'cn';
  dex_num?: number;
  subtypes?: string[] | null;
  /** The TCG's own printed energy type(s) (e.g. "Water", "Lightning", "Colorless") — distinct from the video game's 18 types. */
  types?: string[] | null;
  /** Which finishes (normal/holo/reverse_holo) this print actually comes in, per
   * TCGplayer — null/undefined means unknown (not yet synced, or no TCGplayer
   * data for this print), never treat that as "no finishes exist". */
  available_finishes?: string[] | null;
  cardmarket_trend_eur?: number | null;
}

export function useCardsForPokemon(dexNum: number | undefined) {
  return useQuery({
    queryKey: ['tcg_cards_by_dex', dexNum],
    enabled: !!dexNum,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, set_id, set_name, card_number, rarity, image_small, image_large, release_date, series, region, available_finishes, cardmarket_trend_eur')
        .eq('dex_num', dexNum!)
        .order('release_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TcgCardRow[];
    },
  });
}

const PAGE_SIZE = 1000; // PostgREST caps a single response at this many rows regardless of .limit()

export function useTrainerCards() {
  return useQuery({
    queryKey: ['tcg_trainer_cards'],
    staleTime: Infinity,
    queryFn: async () => {
      const rows: TcgCardRow[] = [];
      let from = 0;
      while (true) {
        // "Supporter" cards depict an actual Trainer character (Cynthia, Iono, Boss's
        // Orders...) — Items/Stadiums/Tools are objects/places, not trainers themselves.
        const { data, error } = await supabase
          .from('tcg_cards')
          .select('id, name, set_id, set_name, card_number, rarity, image_small, image_large, release_date, series, region, subtypes, available_finishes, cardmarket_trend_eur')
          .eq('supertype', 'Trainer')
          .contains('subtypes', ['Supporter'])
          .order('release_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as TcgCardRow[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return rows;
    },
  });
}

export function useCardsForArtist(artist: string | undefined) {
  return useQuery({
    queryKey: ['tcg_cards_by_artist', artist],
    enabled: !!artist,
    staleTime: Infinity,
    queryFn: async () => {
      // Paginated like useTrainerCards above — prolific studio credits (e.g.
      // "5ban Graphics") comfortably exceed PostgREST's 1000-row response cap.
      const rows: TcgCardRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('tcg_cards')
          .select('id, name, dex_num, set_id, set_name, card_number, rarity, image_small, image_large, release_date, series, region, available_finishes, cardmarket_trend_eur')
          .eq('artist', artist!)
          .order('release_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as TcgCardRow[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return rows;
    },
  });
}

export function useCardsForSet(setId: string | undefined) {
  return useQuery({
    queryKey: ['tcg_cards_by_set', setId],
    enabled: !!setId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, dex_num, set_id, set_name, card_number, rarity, image_small, image_large, release_date, series, region, types, available_finishes, cardmarket_trend_eur')
        .eq('set_id', setId!)
        .order('dex_num', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TcgCardRow[];
    },
  });
}
