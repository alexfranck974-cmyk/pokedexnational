-- Turns the private feedback inbox (034_feedback.sql) into a lightweight
-- ticketing + public suggestion box:
--   - feedback.status lets the admin track a bug/suggestion through its life
--   - profiles.is_admin + is_admin() gate the admin-only surface (status
--     changes, seeing every user's tickets) — SECURITY DEFINER so it can read
--     profiles without recursing through profiles' own RLS
--   - feedback_votes: any authenticated user can upvote a *suggestion* (not a
--     bug report) once; public list is sorted by vote count
--   - feedback_comments: a single reply thread per item. Bug tickets stay
--     private to their author + admin; suggestion threads are publicly
--     readable (so an admin reply like "in progress!" is visible to everyone)
--     but only the author or admin may post into either.

ALTER TABLE public.profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.feedback ADD COLUMN status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

CREATE INDEX feedback_kind_status_idx ON public.feedback (kind, status);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $fn_is_admin$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$fn_is_admin$;

-- Admin sees + manages every ticket/suggestion; owners keep tracking their
-- own via the existing feedback_select_self policy from 034.
CREATE POLICY "feedback_select_public_suggestions" ON public.feedback
FOR SELECT USING (kind = 'suggestion');

CREATE POLICY "feedback_select_admin" ON public.feedback
FOR SELECT USING (public.is_admin());

CREATE POLICY "feedback_update_admin" ON public.feedback
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- An author can withdraw their own item while it's still untouched; once
-- triaged (any other status) only admin can remove it.
CREATE POLICY "feedback_delete_self_open" ON public.feedback
FOR DELETE USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "feedback_delete_admin" ON public.feedback
FOR DELETE USING (public.is_admin());

CREATE TABLE public.feedback_votes (
  feedback_id  uuid         NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);

CREATE INDEX feedback_votes_feedback_id_idx ON public.feedback_votes (feedback_id);

ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_votes_select" ON public.feedback_votes
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_votes.feedback_id AND f.kind = 'suggestion')
);

CREATE POLICY "feedback_votes_insert_self" ON public.feedback_votes
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.kind = 'suggestion')
);

CREATE POLICY "feedback_votes_delete_self" ON public.feedback_votes
FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.feedback_comments (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid         NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  author_id   uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX feedback_comments_feedback_id_idx ON public.feedback_comments (feedback_id);

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_comments_select" ON public.feedback_comments
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.feedback f
    WHERE f.id = feedback_comments.feedback_id
      AND (f.kind = 'suggestion' OR f.user_id = auth.uid())
  )
);

CREATE POLICY "feedback_comments_insert" ON public.feedback_comments
FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
  )
);
