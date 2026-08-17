-- "Mes listes" becomes "Mes binders" — a virtual binder is the same underlying
-- user_collections/user_collection_items pair, now with a fixed page layout
-- (cards per page) and an explicit slot position per card, so the UI can
-- render empty "+" placeholders at the right spot instead of a flat list.
-- Changing layout later never needs to touch stored positions — page number
-- and column are derived client-side as position/layout and position%layout.

ALTER TABLE public.user_collections ADD COLUMN layout int2 NOT NULL DEFAULT 9
  CHECK (layout IN (1, 4, 9, 12, 16));

ALTER TABLE public.user_collection_items ADD COLUMN position int4;

UPDATE public.user_collection_items t
SET position = sub.rn - 1
FROM (
  SELECT collection_id, card_id, ROW_NUMBER() OVER (PARTITION BY collection_id ORDER BY added_at) AS rn
  FROM public.user_collection_items
) sub
WHERE t.collection_id = sub.collection_id AND t.card_id = sub.card_id;

ALTER TABLE public.user_collection_items ALTER COLUMN position SET NOT NULL;

CREATE UNIQUE INDEX user_collection_items_position_idx ON public.user_collection_items (collection_id, position);
