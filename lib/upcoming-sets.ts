import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface UpcomingSet {
  sourceId: string;
  name: string;
  region: 'international' | 'jp';
  releaseDate: string | null;
  releaseDateLabel: string;
  imageUrl: string | null;
  sourceUrl: string | null;
}

// Populated weekly by scripts/sync-upcoming-sets.ts scraping a third-party fan
// page — see that script's comments for why neither pokemontcg.io nor TCGdex
// can supply this. staleTime mirrors the TCG indexes (Infinity): this only
// ever changes when the sync script runs, never from anything the user does.
export function useUpcomingSets() {
  return useQuery({
    queryKey: ['upcoming_sets'],
    staleTime: Infinity,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('upcoming_sets')
        .select('source_id, name, region, release_date, release_date_label, image_url, source_url')
        .or(`release_date.is.null,release_date.gte.${today}`)
        .order('release_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((r): UpcomingSet => ({
        sourceId: r.source_id as string,
        name: r.name as string,
        region: r.region as 'international' | 'jp',
        releaseDate: r.release_date as string | null,
        releaseDateLabel: r.release_date_label as string,
        imageUrl: r.image_url as string | null,
        sourceUrl: r.source_url as string | null,
      }));
    },
  });
}
