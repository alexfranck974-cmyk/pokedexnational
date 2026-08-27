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

export interface TcgSetInfo {
  id: string;
  name: string;
  releaseDate: string | null;
  cardCount: number;
  symbol: string | null;
  logo: string | null;
  region: string;
  /** Era grouping ("Mega Evolution", "Scarlet & Violet"...) for global sets.
   * JP/CN carry a flat region label here ("Japon"/"Chine"), not a real
   * per-era value — see 056_tcg_sets_series.sql. */
  series: string | null;
}

export function useTcgSets() {
  return useQuery({
    queryKey: ['tcg_sets'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_sets')
        .select('set_id, set_name, release_date, card_count, set_symbol, set_logo, region, series')
        .order('release_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(row => ({
        id: row.set_id as string,
        name: row.set_name as string,
        releaseDate: (row.release_date as string | null) ?? null,
        cardCount: row.card_count as number,
        symbol: (row.set_symbol as string | null) ?? null,
        logo: (row.set_logo as string | null) ?? null,
        region: (row.region as string | null) ?? 'global',
        series: (row.series as string | null) ?? null,
      })) as TcgSetInfo[];
    },
  });
}

// PostgREST uses `*` as the wildcard for ilike inside .or() raw filter strings (avoids %-encoding issues).
// Two patterns for Mega: modern "Mega X ex" cards, and older "M X-EX" cards (e.g. "M Charizard-EX").
// bucketVariantCards() in lib/dashboard-stats.ts re-filters this superset with precise regexes client-side
// (a plain "*Mega*" contains-match alone would false-positive on names like "Yanmega"/"Meganium", and a
// plain "*Rotom*"/"*Deoxys*" contains-match would sweep in non-forme prints like "Rotom Dex"/"Rotom ex" —
// this query is deliberately a broad superset, the precision lives client-side).
const VARIANT_NAME_CLAUSES = [
  'name.ilike.*Mega*',
  'name.ilike.M *-EX',
  'name.ilike.*Alolan*',
  'name.ilike.*Galarian*',
  'name.ilike.*Hisuian*',
  'name.ilike.*Paldean*',
  'name.ilike.*Rotom*',
  'name.ilike.*Deoxys*',
  'name.ilike.*VMAX*',
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

export interface TcgArtistInfo {
  artist: string;
  cardCount: number;
}

export function useTcgArtists() {
  return useQuery({
    queryKey: ['tcg_artists'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('tcg_artists').select('artist, card_count').order('artist');
      if (error) throw error;
      return (data ?? []).map(row => ({
        artist: row.artist as string,
        cardCount: row.card_count as number,
      })) as TcgArtistInfo[];
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
