-- Friend system: mutual relationship established via request + acceptance.
-- Accepted friends can view a profile's Pokédex/stats/wishlist/vitrine even
-- when is_public is false — is_public still governs anonymous link access.
CREATE TABLE public.friendships (
  requester_id  uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id  uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Either side of the relationship can see it (to render pending/accepted state).
CREATE POLICY "friendships_select_participant" ON public.friendships
FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_insert_requester" ON public.friendships
FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Only the addressee can accept (flip pending -> accepted).
CREATE POLICY "friendships_update_addressee" ON public.friendships
FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

-- Either side can delete: addressee declining, requester cancelling, or
-- either party unfriending an already-accepted relationship.
CREATE POLICY "friendships_delete_participant" ON public.friendships
FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Helper reused by other tables' RLS policies below, and callable directly
-- from the client to decide whether to render a private profile as visible.
CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = user_a AND addressee_id = user_b)
        OR (requester_id = user_b AND addressee_id = user_a))
  );
$$;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- profiles: any signed-in user can look up any profile row by username (to
-- send a friend request) — this table only holds username/display_name/
-- is_public, nothing sensitive. Anonymous visitors still only see public ones.
DROP POLICY "profiles_select_self_or_public" ON public.profiles;

CREATE POLICY "profiles_select_authenticated_or_public" ON public.profiles
FOR SELECT USING (auth.uid() IS NOT NULL OR is_public = true);

-- Extend the "self or public" data policies with "or accepted friend".
DROP POLICY "user_cards_select_self_or_public_profile" ON public.user_cards;
CREATE POLICY "user_cards_select_self_public_or_friend" ON public.user_cards
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
  OR public.are_friends(auth.uid(), user_id)
);

DROP POLICY "user_wishlist_select_self_or_public_profile" ON public.user_wishlist;
CREATE POLICY "user_wishlist_select_self_public_or_friend" ON public.user_wishlist
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
  OR public.are_friends(auth.uid(), user_id)
);

DROP POLICY "user_favorites_select_self_or_public_profile" ON public.user_favorites;
CREATE POLICY "user_favorites_select_self_public_or_friend" ON public.user_favorites
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
  OR public.are_friends(auth.uid(), user_id)
);
