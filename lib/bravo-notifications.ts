import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from './types';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

export interface BravoEvent {
  id: string;
  reactorName: string;
  pokemonType: PokemonType | null;
}

// Realtime "someone reacted to your card" notification — a small in-memory
// queue (not the shared bottom toast in lib/toast.ts) so it can carry a type
// icon and show one at a time without colliding with unrelated toasts.
// v1, deliberately simple: no persistence across reloads, no cap on queue
// size beyond what a session would realistically produce.
export function useBravoNotifications(userId?: string) {
  const [queue, setQueue] = useState<BravoEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`bravo:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_news_reactions' },
        async (payload) => {
          const row = payload.new as { news_id: string; user_id: string };
          if (row.user_id === userId) return; // reacting to your own card isn't notable

          const key = `${row.news_id}:${row.user_id}:${payload.commit_timestamp}`;
          if (seenRef.current.has(key)) return;
          seenRef.current.add(key);

          const { data: news } = await supabase
            .from('friend_news')
            .select('user_id, card:tcg_cards(dex_num)')
            .eq('id', row.news_id)
            .single();
          if (!news || news.user_id !== userId) return; // a reaction on a card that isn't mine

          const { data: reactor } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', row.user_id)
            .single();

          const dexNum = (news.card as unknown as { dex_num?: number } | null)?.dex_num;
          const pokemonType = dexNum ? POKEDEX_BY_DEX.get(dexNum)?.types[0] ?? null : null;

          setQueue(q => [...q, {
            id: key,
            reactorName: reactor?.display_name || reactor?.username || '?',
            pokemonType: pokemonType ?? null,
          }]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const current = queue[0] ?? null;
  const dismiss = () => setQueue(q => q.slice(1));
  return { current, dismiss };
}
