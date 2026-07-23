-- Favorites were private-only (see 013). The public share page now shows a
-- "Hall of Fame" carousel of the owner's favorited cards, so extend visibility
-- to public profiles too, same pattern as 018 for the wishlist.
DROP POLICY "user_favorites_select_self" ON public.user_favorites;

CREATE POLICY "user_favorites_select_self_or_public_profile" ON public.user_favorites
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
);
