-- Wishlist was private-only (see 009). The public share page now has a Wishlist tab
-- alongside Pokédex progress and stats, so extend visibility to public profiles too.
DROP POLICY "user_wishlist_select_self" ON public.user_wishlist;

CREATE POLICY "user_wishlist_select_self_or_public_profile" ON public.user_wishlist
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
);
