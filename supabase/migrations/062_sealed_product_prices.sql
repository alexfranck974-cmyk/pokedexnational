-- Market price per (set, product_type) — shared reference data, not per-user
-- (mirrors tcg_cards' cardmarket_* columns being central and user_cards just
-- referencing the card). Only ever written by the sync-sealed-product-prices
-- script (service_role); price_eur stays null for anything not yet mapped to
-- a verified TCGPlayer group, or for a product_type that doesn't have a
-- reliable automatic match within a set (e.g. "coffret" — see the script's
-- own comments) — the client already treats a missing price as "unknown",
-- same as it does for card prices.
CREATE TABLE public.sealed_product_prices (
  set_id       text        NOT NULL,
  product_type text        NOT NULL CHECK (product_type IN ('display_box', 'booster_box', 'etb', 'blister', 'coffret', 'booster', 'autre')),
  price_eur    numeric(10,2),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, product_type)
);

ALTER TABLE public.sealed_product_prices ENABLE ROW LEVEL SECURITY;

-- Public read, same as tcg_cards/tcg_sets — every signed-in user with sealed
-- products tracked needs this, and there's nothing user-specific in it.
CREATE POLICY "sealed_product_prices_select_all" ON public.sealed_product_prices
FOR SELECT USING (true);
