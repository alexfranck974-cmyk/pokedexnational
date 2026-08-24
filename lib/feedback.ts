import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { toast } from './toast';
import type { Locale } from './locale';

export type FeedbackKind = 'bug' | 'suggestion';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

const STATUS_LABEL_FR: Record<FeedbackStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const STATUS_LABEL_EN: Record<FeedbackStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function getStatusLabel(status: FeedbackStatus, locale: Locale): string {
  return locale === 'en' ? STATUS_LABEL_EN[status] : STATUS_LABEL_FR[status];
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  userId: string;
}

export interface SuggestionItem extends FeedbackItem {
  authorName: string;
  voteCount: number;
}

export interface AdminFeedbackItem extends FeedbackItem {
  authorName: string;
}

export interface FeedbackComment {
  id: string;
  feedbackId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

function toAuthorName(profile: any): string {
  return profile?.display_name || profile?.username || '?';
}

// Own submission history — self-only per RLS, most recent first.
export function useMyFeedback(userId?: string) {
  return useQuery({
    queryKey: ['feedback', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, kind, message, status, created_at, user_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): FeedbackItem => ({
        id: row.id,
        kind: row.kind as FeedbackKind,
        message: row.message,
        status: row.status as FeedbackStatus,
        createdAt: row.created_at,
        userId: row.user_id,
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
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['feedback', userId] });
      qc.invalidateQueries({ queryKey: ['public_suggestions'] });
    },
    onError: () => toast('Impossible d’envoyer ce message, réessaie.'),
  });
}

// Whether the signed-in user is the app admin — gates the admin tab + status
// controls. Cached for a while since it practically never flips at runtime.
export function useIsAdmin(userId?: string) {
  return useQuery({
    queryKey: ['is_admin', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin').eq('id', userId!).single();
      if (error) throw error;
      return !!data?.is_admin;
    },
  });
}

// Public suggestion board — every user's suggestion, vote count embedded via
// PostgREST's count aggregate. Sorted client-side (votes desc, then newest)
// since ordering by an embedded aggregate isn't expressible in PostgREST.
export function usePublicSuggestions() {
  return useQuery({
    queryKey: ['public_suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, message, status, created_at, user_id, profiles(username, display_name), feedback_votes(count)')
        .eq('kind', 'suggestion');
      if (error) throw error;
      return (data ?? [])
        .map((row: any): SuggestionItem => ({
          id: row.id,
          kind: 'suggestion',
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
          userId: row.user_id,
          authorName: toAuthorName(row.profiles),
          voteCount: row.feedback_votes?.[0]?.count ?? 0,
        }))
        .sort((a, b) => b.voteCount - a.voteCount || +new Date(b.createdAt) - +new Date(a.createdAt));
    },
  });
}

// Suggestion ids the current user has already upvoted.
export function useMyVotes(userId?: string) {
  return useQuery({
    queryKey: ['my_feedback_votes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('feedback_votes').select('feedback_id').eq('user_id', userId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.feedback_id as string));
    },
  });
}

export function useToggleVote(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, voted }: { feedbackId: string; voted: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      if (voted) {
        const { error } = await supabase.from('feedback_votes').delete().eq('feedback_id', feedbackId).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feedback_votes').insert({ feedback_id: feedbackId, user_id: userId });
        if (error) throw error;
      }
    },
    onMutate: async ({ feedbackId, voted }) => {
      await qc.cancelQueries({ queryKey: ['public_suggestions'] });
      await qc.cancelQueries({ queryKey: ['my_feedback_votes', userId] });
      const prevSuggestions = qc.getQueryData<SuggestionItem[]>(['public_suggestions']);
      const prevVotes = qc.getQueryData<Set<string>>(['my_feedback_votes', userId]);
      qc.setQueryData<SuggestionItem[]>(['public_suggestions'], (old) =>
        (old ?? []).map((s) => s.id === feedbackId ? { ...s, voteCount: s.voteCount + (voted ? -1 : 1) } : s));
      qc.setQueryData<Set<string>>(['my_feedback_votes', userId], (old) => {
        const next = new Set(old ?? []);
        if (voted) next.delete(feedbackId); else next.add(feedbackId);
        return next;
      });
      return { prevSuggestions, prevVotes };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevSuggestions) qc.setQueryData(['public_suggestions'], ctx.prevSuggestions);
      if (ctx?.prevVotes) qc.setQueryData(['my_feedback_votes', userId], ctx.prevVotes);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['public_suggestions'] });
      qc.invalidateQueries({ queryKey: ['my_feedback_votes', userId] });
    },
  });
}

const STATUS_ORDER: Record<FeedbackStatus, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

// Admin-only: every ticket/suggestion across all users, open items first.
export function useAdminFeedback() {
  return useQuery({
    queryKey: ['admin_feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, kind, message, status, created_at, user_id, profiles(username, display_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row: any): AdminFeedbackItem => ({
          id: row.id,
          kind: row.kind,
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
          userId: row.user_id,
          authorName: toAuthorName(row.profiles),
        }))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || +new Date(b.createdAt) - +new Date(a.createdAt));
    },
  });
}

export function useUpdateFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, status }: { feedbackId: string; status: FeedbackStatus }) => {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', feedbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_feedback'] });
      qc.invalidateQueries({ queryKey: ['public_suggestions'] });
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

// Single reply thread per item — private (author + admin) for bugs, public
// read for suggestions (see 040_feedback_status_votes_comments.sql RLS).
export function useFeedbackComments(feedbackId: string | null) {
  return useQuery({
    queryKey: ['feedback_comments', feedbackId],
    enabled: !!feedbackId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_comments')
        .select('id, feedback_id, author_id, body, created_at, profiles(username, display_name)')
        .eq('feedback_id', feedbackId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any): FeedbackComment => ({
        id: row.id,
        feedbackId: row.feedback_id,
        authorId: row.author_id,
        authorName: toAuthorName(row.profiles),
        body: row.body,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useAddFeedbackComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, authorId, body }: { feedbackId: string; authorId: string; body: string }) => {
      const { error } = await supabase.from('feedback_comments').insert({ feedback_id: feedbackId, author_id: authorId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: (_data, { feedbackId }) => qc.invalidateQueries({ queryKey: ['feedback_comments', feedbackId] }),
    onError: () => toast('Impossible d’envoyer ce message, réessaie.'),
  });
}
