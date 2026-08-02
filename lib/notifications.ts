import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from './types';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

export type AppNotification =
  | { id: string; kind: 'bravo'; counterpartyName: string; pokemonType: PokemonType | null }
  | { id: string; kind: 'trade_received'; counterpartyName: string }
  | { id: string; kind: 'trade_accepted'; counterpartyName: string }
  | { id: string; kind: 'trade_completed'; counterpartyName: string }
  | { id: string; kind: 'friend_request_received'; counterpartyName: string }
  | { id: string; kind: 'friend_request_accepted'; counterpartyName: string };

async function counterpartyName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name, username').eq('id', userId).single();
  return data?.display_name || data?.username || '?';
}

// Realtime floating notifications — bravo reactions on your cards, plus the
// trade lifecycle (received / accepted / completed). A small in-memory queue
// (not the shared bottom toast in lib/toast.ts) so it can carry a type/trade
// icon and show one at a time without colliding with unrelated toasts.
// v1, deliberately simple: no persistence across reloads, no cap on queue
// size beyond what a session would realistically produce.
export function useAppNotifications(userId?: string) {
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const push = (n: AppNotification) => {
      if (seenRef.current.has(n.id)) return;
      seenRef.current.add(n.id);
      setQueue(q => [...q, n]);
    };

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_news_reactions' },
        async (payload) => {
          const row = payload.new as { news_id: string; user_id: string };
          if (row.user_id === userId) return; // reacting to your own card isn't notable

          const key = `bravo:${row.news_id}:${row.user_id}:${payload.commit_timestamp}`;
          const { data: news } = await supabase
            .from('friend_news')
            .select('user_id, card:tcg_cards(dex_num)')
            .eq('id', row.news_id)
            .single();
          if (!news || news.user_id !== userId) return; // a reaction on a card that isn't mine

          const dexNum = (news.card as unknown as { dex_num?: number } | null)?.dex_num;
          const pokemonType = dexNum ? POKEDEX_BY_DEX.get(dexNum)?.types[0] ?? null : null;
          push({ id: key, kind: 'bravo', counterpartyName: await counterpartyName(row.user_id), pokemonType: pokemonType ?? null });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_offers' },
        async (payload) => {
          const row = payload.new as { id: string; receiver_id: string; proposer_id: string };
          if (row.receiver_id !== userId) return; // only the receiver gets a "new proposal" ping

          const key = `trade_received:${row.id}`;
          push({ id: key, kind: 'trade_received', counterpartyName: await counterpartyName(row.proposer_id) });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trade_offers' },
        async (payload) => {
          const oldRow = payload.old as { status?: string };
          const newRow = payload.new as { id: string; status: string; proposer_id: string; receiver_id: string };
          if (oldRow.status === newRow.status) return; // not a status transition

          const amProposer = newRow.proposer_id === userId;
          const amReceiver = newRow.receiver_id === userId;
          if (!amProposer && !amReceiver) return;

          if (oldRow.status === 'pending' && newRow.status === 'in_progress' && amProposer) {
            // The receiver accepted — only the proposer finds this notable
            // (the receiver already sees their own "accepted" toast).
            const key = `trade_accepted:${newRow.id}`;
            push({ id: key, kind: 'trade_accepted', counterpartyName: await counterpartyName(newRow.receiver_id) });
          } else if (oldRow.status === 'in_progress' && newRow.status === 'completed') {
            // Both sides get this one — whichever side just clicked "confirm"
            // already has their own toast, a little overlap is fine, and the
            // side that confirmed earlier and has been waiting definitely
            // wants to know it's done.
            const counterpartyId = amProposer ? newRow.receiver_id : newRow.proposer_id;
            const key = `trade_completed:${newRow.id}:${userId}`;
            push({ id: key, kind: 'trade_completed', counterpartyName: await counterpartyName(counterpartyId) });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friendships' },
        async (payload) => {
          const row = payload.new as { requester_id: string; addressee_id: string };
          if (row.addressee_id !== userId) return; // only the recipient gets pinged

          const key = `friend_request_received:${row.requester_id}:${row.addressee_id}`;
          push({ id: key, kind: 'friend_request_received', counterpartyName: await counterpartyName(row.requester_id) });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friendships' },
        async (payload) => {
          // The RLS policy (friendships_update_addressee) only lets the
          // addressee update a row, and the app never calls it for anything
          // but accepting — so unlike trade_offers, no old.status check is
          // needed to know an UPDATE here means "accepted."
          const row = payload.new as { requester_id: string; addressee_id: string };
          if (row.requester_id !== userId) return; // only the original sender finds this notable

          const key = `friend_request_accepted:${row.requester_id}:${row.addressee_id}`;
          push({ id: key, kind: 'friend_request_accepted', counterpartyName: await counterpartyName(row.addressee_id) });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const current = queue[0] ?? null;
  const dismiss = () => setQueue(q => q.slice(1));
  return { current, dismiss };
}
