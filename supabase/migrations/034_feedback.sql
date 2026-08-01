-- Lightweight in-app feedback/suggestion box (Settings) — a user submits a bug
-- report or an improvement suggestion and can see their own submission history.
-- No admin reply/status workflow yet (no admin surface exists in this app) —
-- just a durable inbox instead of losing feedback to a chat message.
CREATE TABLE public.feedback (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        text         NOT NULL DEFAULT 'suggestion' CHECK (kind IN ('bug', 'suggestion')),
  message     text         NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX feedback_user_id_idx ON public.feedback (user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Self-only both ways — this isn't a public/friend-visible feed, just a private
-- inbox between the user and whoever reads the table directly in Supabase.
CREATE POLICY "feedback_select_self" ON public.feedback
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "feedback_insert_self" ON public.feedback
FOR INSERT WITH CHECK (auth.uid() = user_id);
