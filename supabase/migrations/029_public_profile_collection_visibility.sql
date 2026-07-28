-- "Sets en cours" and "cartes possédées" now surface on a friend's public
-- profile (app/u/[username].tsx, Collection tab) — extend visibility to the
-- same self/public-profile/friend rule already used for user_cards,
-- user_wishlist and user_favorites (migration 022). user_set_goals was
-- previously "private only" (023) — this product decision supersedes that.
DROP POLICY "user_set_goals_select_self" ON public.user_set_goals;
CREATE POLICY "user_set_goals_select_self_public_or_friend" ON public.user_set_goals
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
  OR public.are_friends(auth.uid(), user_id)
);

DROP POLICY "user_owned_cards_select_self" ON public.user_owned_cards;
CREATE POLICY "user_owned_cards_select_self_public_or_friend" ON public.user_owned_cards
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
  OR public.are_friends(auth.uid(), user_id)
);
