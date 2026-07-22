import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { TcgIndex } from './pokedex-list';
import type { VariantCard } from './dashboard-stats';

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

// PostgREST uses `*` as the wildcard for ilike inside .or() raw filter strings (avoids %-encoding issues).
// Two patterns for Mega: modern "Mega X ex" cards, and older "M X-EX" cards (e.g. "M Charizard-EX").
// bucketVariantCards() in lib/dashboard-stats.ts re-filters this superset with precise regexes client-side
// (a plain "*Mega*" contains-match alone would false-positive on names like "Yanmega"/"Meganium").
const VARIANT_NAME_CLAUSES = [
  'name.ilike.*Mega*',
  'name.ilike.M *-EX',
  'name.ilike.*Alolan*',
  'name.ilike.*Galarian*',
  'name.ilike.*Hisuian*',
  'name.ilike.*Paldean*',
];

export function useVariantCards() {
  return useQuery({
    queryKey: ['tcg_variant_cards'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, dex_num, image_small, image_large')
        .or(VARIANT_NAME_CLAUSES.join(','));
      if (error) throw error;
      return (data ?? []).map(r => ({
        id: r.id as string,
        name: r.name as string,
        dex_num: r.dex_num as number,
        imageSmall: r.image_small as string,
        imageLarge: (r.image_large as string | undefined) ?? null,
      })) as VariantCard[];
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
