-- Friend activity feed: "a friend got a notable card" pop-up, reactable.
-- "Notable" mirrors the chase-tier rarity classification already used for the
-- solo capture celebration (lib/rarity-tiers.ts) — only genuinely rare pulls
-- generate news, not every card added.
CREATE TABLE public.friend_news (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id       text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  rarity_label  text         NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX friend_news_user_id_idx ON public.friend_news (user_id);
CREATE INDEX friend_news_created_at_idx ON public.friend_news (created_at DESC);

ALTER TABLE public.friend_news ENABLE ROW LEVEL SECURITY;

-- Visible to the author and to accepted friends only (reuses are_friends() from
-- the friend system, migration 022).
CREATE POLICY "friend_news_select_self_or_friend" ON public.friend_news
FOR SELECT USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

CREATE POLICY "friend_news_insert_self" ON public.friend_news
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Per-viewer dismissal, so a pop-up already seen doesn't resurface on the next
-- foreground fetch (client polls on app open/foreground — no realtime).
CREATE TABLE public.friend_news_dismissed (
  news_id       uuid         NOT NULL REFERENCES public.friend_news(id) ON DELETE CASCADE,
  user_id       uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);

ALTER TABLE public.friend_news_dismissed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_news_dismissed_select_self" ON public.friend_news_dismissed
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "friend_news_dismissed_insert_self" ON public.friend_news_dismissed
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- One emoji reaction per (news item, reactor) — a re-tap swaps the emoji via upsert.
CREATE TABLE public.friend_news_reactions (
  news_id     uuid         NOT NULL REFERENCES public.friend_news(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);

ALTER TABLE public.friend_news_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_news_reactions_select_visible_news" ON public.friend_news_reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.friend_news n
    WHERE n.id = news_id AND (n.user_id = auth.uid() OR public.are_friends(auth.uid(), n.user_id))
  )
);

CREATE POLICY "friend_news_reactions_insert_self" ON public.friend_news_reactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friend_news_reactions_update_self" ON public.friend_news_reactions
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
