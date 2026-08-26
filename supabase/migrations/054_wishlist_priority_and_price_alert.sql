-- "Coup de cœur" flag (pins a wishlist card to the top, see wishlist-list.ts's
-- stable partition sort) and an optional target price — the wishlist screen
-- flags a card as alert-triggered once tcg_cards.cardmarket_trend_eur drops
-- to or below it. Both nullable/defaulted so every existing wishlist row is
-- unaffected until the user touches either control.
ALTER TABLE public.user_wishlist ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_wishlist ADD COLUMN price_alert_eur numeric;

-- No UPDATE policy existed yet (the table only ever supported add/remove via
-- insert/delete) — needed now that these two fields are edited in place.
CREATE POLICY "user_wishlist_update_self" ON public.user_wishlist
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
