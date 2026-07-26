import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export interface FriendProfile {
  id: string;
  username: string;
  displayName: string;
}

// Everyone this user has an accepted friendship with.
export function useFriends(userId?: string) {
  return useQuery({
    queryKey: ['friends', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, display_name), addressee:profiles!friendships_addressee_id_fkey(id, username, display_name)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      if (error) throw error;
      return (data ?? []).map(row => {
        const other = row.requester_id === userId ? (row.addressee as any) : (row.requester as any);
        return { id: other.id as string, username: other.username as string, displayName: other.display_name as string };
      }) as FriendProfile[];
    },
  });
}

export interface FriendRequest {
  id: string; // the other user's id
  username: string;
  displayName: string;
  createdAt: string;
}

export function useIncomingRequests(userId?: string) {
  return useQuery({
    queryKey: ['friend_requests_incoming', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('created_at, requester:profiles!friendships_requester_id_fkey(id, username, display_name)')
        .eq('status', 'pending')
        .eq('addressee_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(row => {
        const r = row.requester as any;
        return { id: r.id as string, username: r.username as string, displayName: r.display_name as string, createdAt: row.created_at as string };
      }) as FriendRequest[];
    },
  });
}

export function useOutgoingRequests(userId?: string) {
  return useQuery({
    queryKey: ['friend_requests_outgoing', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('created_at, addressee:profiles!friendships_addressee_id_fkey(id, username, display_name)')
        .eq('status', 'pending')
        .eq('requester_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(row => {
        const a = row.addressee as any;
        return { id: a.id as string, username: a.username as string, displayName: a.display_name as string, createdAt: row.created_at as string };
      }) as FriendRequest[];
    },
  });
}

// Looks up a profile by exact username for the "add friend" search — works
// regardless of is_public, since any signed-in user can look up any username.
export function useFindProfileByUsername(username: string) {
  return useQuery({
    queryKey: ['find_profile', username],
    enabled: username.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, username: data.username, displayName: data.display_name } as FriendProfile : null;
    },
  });
}

export type FriendshipStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received';

// Used on a profile page to decide which friend-related action to offer:
// add / cancel / accept / already-friends.
export function useFriendshipStatus(viewerId?: string, otherId?: string) {
  return useQuery({
    queryKey: ['friendship_status', viewerId, otherId],
    enabled: !!viewerId && !!otherId && viewerId !== otherId,
    queryFn: async (): Promise<FriendshipStatus> => {
      const { data, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${viewerId})`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return 'none';
      if (data.status === 'accepted') return 'friends';
      return data.requester_id === viewerId ? 'pending_sent' : 'pending_received';
    },
  });
}

function useInvalidateFriends(userId?: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['friends', userId] });
    qc.invalidateQueries({ queryKey: ['friend_requests_incoming', userId] });
    qc.invalidateQueries({ queryKey: ['friend_requests_outgoing', userId] });
    qc.invalidateQueries({ queryKey: ['friendship_status'] });
  };
}

export function useSendFriendRequest() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateFriends(userId);
  return useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: addresseeId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible d’envoyer la demande, réessaie.'),
  });
}

export function useAcceptFriendRequest() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateFriends(userId);
  return useMutation({
    mutationFn: async (requesterId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester_id', requesterId).eq('addressee_id', userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible d’accepter la demande, réessaie.'),
  });
}

// Covers declining an incoming request, cancelling an outgoing one, and
// unfriending an already-accepted relationship — always a symmetric delete.
export function useRemoveFriendship() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateFriends(userId);
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('friendships').delete()
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Action impossible, réessaie.'),
  });
}
