-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_self_or_public" ON public.profiles
FOR SELECT USING (auth.uid() = id OR is_public = true);

-- Username immutability is enforced by a BEFORE UPDATE trigger in 006 (RLS cannot reference OLD in WITH CHECK cleanly).
CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- tcg_cards
ALTER TABLE public.tcg_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tcg_cards_select_all" ON public.tcg_cards
FOR SELECT USING (true);

-- user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards_select_self_or_public_profile" ON public.user_cards
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
);

CREATE POLICY "user_cards_insert_self" ON public.user_cards
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_cards_delete_self" ON public.user_cards
FOR DELETE USING (auth.uid() = user_id);
