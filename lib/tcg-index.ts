import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { TcgIndex } from './pokedex-list';

export function useTcgIndex() {
  return useQuery({
    queryKey: ['pokemon_tcg_index'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('pokemon_tcg_index').select('dex_num, set_ids, rarities');
      if (error) throw error;
      const map: TcgIndex = new Map();
      for (const row of data ?? []) {
        map.set(row.dex_num as number, {
          set_ids: (row.set_ids ?? []) as string[],
          rarities: (row.rarities ?? []) as string[],
        });
      }
      return map;
    },
  });
}

export function useTcgSets() {
  return useQuery({
    queryKey: ['tcg_sets'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_sets')
        .select('set_id, set_name, release_date')
        .order('release_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(row => ({
        id: row.set_id as string,
        name: row.set_name as string,
      }));
    },
  });
}

export function useTcgRarities() {
  return useQuery({
    queryKey: ['tcg_rarities'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_rarities')
        .select('rarity')
        .order('rarity');
      if (error) throw error;
      return (data ?? []).map(r => r.rarity as string);
    },
  });
}
