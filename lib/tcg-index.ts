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
        .from('tcg_cards')
        .select('set_id, set_name, release_date')
        .order('release_date', { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const out: { id: string; name: string }[] = [];
      for (const row of data ?? []) {
        if (seen.has(row.set_id as string)) continue;
        seen.add(row.set_id as string);
        out.push({ id: row.set_id as string, name: row.set_name as string });
      }
      return out;
    },
  });
}

export function useTcgRarities() {
  return useQuery({
    queryKey: ['tcg_rarities'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('rarity')
        .not('rarity', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) if (row.rarity) set.add(row.rarity as string);
      return Array.from(set).sort();
    },
  });
}
