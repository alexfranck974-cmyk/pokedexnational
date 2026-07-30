-- Enables Realtime (Postgres logical replication) on the 3 tables driving the
-- Social tab's live signals — without this, no client ever receives
-- postgres_changes events for them regardless of client-side subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_news;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
