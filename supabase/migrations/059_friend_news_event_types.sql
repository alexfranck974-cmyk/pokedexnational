-- Generalizes friend_news beyond "friend pulled a chase-rarity card" into a
-- typed event feed. friend_news_dismissed/friend_news_reactions need no
-- changes — they already just reference news_id generically, regardless of
-- what kind of event it is.
ALTER TABLE public.friend_news
  ADD COLUMN event_type text NOT NULL DEFAULT 'chase_card'
    CHECK (event_type IN ('chase_card', 'sealed_product', 'trade_completed', 'binder_completed', 'set_goal_completed')),
  ALTER COLUMN card_id DROP NOT NULL,
  ALTER COLUMN rarity_label DROP NOT NULL,
  ADD COLUMN sealed_set_id text,
  ADD COLUMN sealed_set_name text,
  ADD COLUMN sealed_product_type text,
  ADD COLUMN trade_offer_id uuid REFERENCES public.trade_offers(id) ON DELETE SET NULL,
  ADD COLUMN binder_id uuid REFERENCES public.user_collections(id) ON DELETE SET NULL,
  ADD COLUMN binder_name text,
  ADD COLUMN set_goal_set_id text,
  ADD COLUMN set_goal_set_name text;
