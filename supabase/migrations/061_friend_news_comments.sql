-- Lightweight comment thread on a friend_news event — same shape as
-- feedback_comments (040), immutable (no update/delete), visibility mirrors
-- friend_news_reactions' existing EXISTS pattern (self or accepted friend of
-- the news author).
CREATE TABLE public.friend_news_comments (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id     uuid         NOT NULL REFERENCES public.friend_news(id) ON DELETE CASCADE,
  author_id   uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX friend_news_comments_news_id_idx ON public.friend_news_comments (news_id);

ALTER TABLE public.friend_news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_news_comments_select_visible_news" ON public.friend_news_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.friend_news n
    WHERE n.id = news_id AND (n.user_id = auth.uid() OR public.are_friends(auth.uid(), n.user_id))
  )
);

CREATE POLICY "friend_news_comments_insert_self" ON public.friend_news_comments
FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.friend_news n
    WHERE n.id = news_id AND (n.user_id = auth.uid() OR public.are_friends(auth.uid(), n.user_id))
  )
);
