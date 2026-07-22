CREATE TABLE public.user_teams (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  position    int2         NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX user_teams_user_id_idx ON public.user_teams (user_id);

CREATE TABLE public.user_team_slots (
  team_id     uuid  NOT NULL REFERENCES public.user_teams(id) ON DELETE CASCADE,
  slot_index  int2  NOT NULL CHECK (slot_index BETWEEN 0 AND 5),
  dex_num     int2  NOT NULL CHECK (dex_num BETWEEN 1 AND 1025),
  PRIMARY KEY (team_id, slot_index),
  UNIQUE (team_id, dex_num)
);

ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_team_slots ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing for teams
CREATE POLICY "user_teams_select_self" ON public.user_teams
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_teams_insert_self" ON public.user_teams
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_teams_update_self" ON public.user_teams
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_teams_delete_self" ON public.user_teams
FOR DELETE USING (auth.uid() = user_id);

-- user_team_slots has no user_id column, so policies gate through the parent team.
CREATE POLICY "user_team_slots_select_self" ON public.user_team_slots
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_teams t WHERE t.id = team_id AND t.user_id = auth.uid())
);

CREATE POLICY "user_team_slots_insert_self" ON public.user_team_slots
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_teams t WHERE t.id = team_id AND t.user_id = auth.uid())
);

CREATE POLICY "user_team_slots_update_self" ON public.user_team_slots
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_teams t WHERE t.id = team_id AND t.user_id = auth.uid())
);

CREATE POLICY "user_team_slots_delete_self" ON public.user_team_slots
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_teams t WHERE t.id = team_id AND t.user_id = auth.uid())
);
