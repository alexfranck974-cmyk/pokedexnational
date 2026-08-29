-- Sealed products (scellés) inventory — a simple per-set, per-product-type
-- quantity tracker (booster boxes, ETBs, display boxes...). No market-price
-- catalog, no per-product art — the client reuses the set's own logo
-- (tcg_sets.set_logo) for display, so no image/catalog columns needed here.
-- No FK on set_id: tcg_sets is a VIEW over tcg_cards, not a table, matching
-- user_set_goals (023_user_set_goals.sql)'s same choice.
CREATE TABLE public.user_sealed_products (
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_id       text        NOT NULL,
  product_type text        NOT NULL CHECK (product_type IN ('display_box', 'booster_box', 'etb', 'blister', 'coffret', 'booster', 'autre')),
  quantity     int         NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id, product_type)
);

CREATE INDEX user_sealed_products_user_id_idx ON public.user_sealed_products (user_id);

ALTER TABLE public.user_sealed_products ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing, same as user_set_goals
CREATE POLICY "user_sealed_products_select_self" ON public.user_sealed_products
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_sealed_products_insert_self" ON public.user_sealed_products
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_sealed_products_update_self" ON public.user_sealed_products
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_sealed_products_delete_self" ON public.user_sealed_products
FOR DELETE USING (auth.uid() = user_id);
