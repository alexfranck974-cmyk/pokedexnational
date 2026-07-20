-- Add dex_num column (denormalized) to enforce single-card-per-Pokemon constraint.
ALTER TABLE public.user_cards ADD COLUMN dex_num int2;

-- Backfill from tcg_cards.
UPDATE public.user_cards uc
SET dex_num = tc.dex_num
FROM public.tcg_cards tc
WHERE tc.id = uc.card_id;

-- Dedup: for each (user_id, dex_num), keep only the most recently acquired card.
DELETE FROM public.user_cards a
USING public.user_cards b
WHERE a.user_id = b.user_id
  AND a.dex_num = b.dex_num
  AND a.card_id <> b.card_id
  AND (a.acquired_at < b.acquired_at
       OR (a.acquired_at = b.acquired_at AND a.card_id < b.card_id));

-- Enforce NOT NULL now that everything is backfilled.
ALTER TABLE public.user_cards ALTER COLUMN dex_num SET NOT NULL;

-- Swap primary key: was (user_id, card_id), now (user_id, dex_num).
ALTER TABLE public.user_cards DROP CONSTRAINT user_cards_pkey;
ALTER TABLE public.user_cards ADD PRIMARY KEY (user_id, dex_num);

-- Keep card_id searchable + still FK.
CREATE INDEX user_cards_card_id_idx ON public.user_cards (card_id);

-- Auto-populate dex_num on INSERT so the client doesn't need to send it.
CREATE OR REPLACE FUNCTION public.set_user_card_dex_num()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dex_num IS NULL THEN
    SELECT dex_num INTO NEW.dex_num FROM public.tcg_cards WHERE id = NEW.card_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_cards_set_dex_num
  BEFORE INSERT OR UPDATE ON public.user_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_user_card_dex_num();
