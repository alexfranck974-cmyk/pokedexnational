CREATE TABLE public.profiles (
  id            uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text          NOT NULL UNIQUE
                              CHECK (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  display_name  text          NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  is_public     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX profiles_username_idx ON public.profiles (username);
