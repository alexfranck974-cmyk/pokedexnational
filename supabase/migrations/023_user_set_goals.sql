CREATE TABLE public.user_set_goals (
  user_id    uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_id     text         NOT NULL,
  pinned_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

CREATE INDEX user_set_goals_user_id_idx ON public.user_set_goals (user_id);

ALTER TABLE public.user_set_goals ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing for goals
CREATE POLICY "user_set_goals_select_self" ON public.user_set_goals
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_set_goals_insert_self" ON public.user_set_goals
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_set_goals_delete_self" ON public.user_set_goals
FOR DELETE USING (auth.uid() = user_id);
