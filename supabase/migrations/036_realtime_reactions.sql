-- Enables Realtime on friend_news_reactions — needed for the floating "bravo
-- reçu de ..." notification (lib/bravo-notifications.ts) to receive
-- postgres_changes events when someone reacts to your card. Same reason as
-- migration 033: without this, no client ever gets the event regardless of
-- client-side subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_news_reactions;
