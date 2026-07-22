import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export interface TeamSlot {
  slotIndex: number;
  dexNum: number;
}

export interface Team {
  id: string;
  name: string;
  slots: TeamSlot[];
}

export function useTeams(userId?: string) {
  return useQuery({
    queryKey: ['teams', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_teams')
        .select('id, name, user_team_slots(slot_index, dex_num)')
        .eq('user_id', userId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(t => ({
        id: t.id as string,
        name: t.name as string,
        slots: ((t.user_team_slots ?? []) as any[]).map(s => ({
          slotIndex: s.slot_index as number,
          dexNum: s.dex_num as number,
        })),
      })) as Team[];
    },
  });
}

function useInvalidateTeams() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return () => qc.invalidateQueries({ queryKey: ['teams', userId] });
}

export function useCreateTeam() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateTeams();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('user_teams')
        .insert({ user_id: userId, name })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de créer l’équipe, réessaie.'),
  });
}

export function useRenameTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
      const { error } = await supabase.from('user_teams').update({ name }).eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de renommer l’équipe, réessaie.'),
  });
}

export function useDeleteTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('user_teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de supprimer l’équipe, réessaie.'),
  });
}

export function useSetTeamSlot() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, slotIndex, dexNum }: { teamId: string; slotIndex: number; dexNum: number }) => {
      const { error } = await supabase
        .from('user_team_slots')
        .upsert({ team_id: teamId, slot_index: slotIndex, dex_num: dexNum }, { onConflict: 'team_id,slot_index' });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible d’assigner ce Pokémon, réessaie.'),
  });
}

export function useClearTeamSlot() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, slotIndex }: { teamId: string; slotIndex: number }) => {
      const { error } = await supabase
        .from('user_team_slots')
        .delete()
        .eq('team_id', teamId)
        .eq('slot_index', slotIndex);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de vider ce slot, réessaie.'),
  });
}
