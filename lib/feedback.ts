import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type FeedbackKind = 'bug' | 'suggestion';

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  message: string;
  createdAt: string;
}

// Own submission history — self-only per RLS, most recent first.
export function useMyFeedback(userId?: string) {
  return useQuery({
    queryKey: ['feedback', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, kind, message, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): FeedbackItem => ({
        id: row.id,
        kind: row.kind as FeedbackKind,
        message: row.message,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, kind, message }: { userId: string; kind: FeedbackKind; message: string }) => {
      const { error } = await supabase.from('feedback').insert({ user_id: userId, kind, message: message.trim() });
      if (error) throw error;
    },
    onSuccess: (_data, { userId }) => qc.invalidateQueries({ queryKey: ['feedback', userId] }),
  });
}
