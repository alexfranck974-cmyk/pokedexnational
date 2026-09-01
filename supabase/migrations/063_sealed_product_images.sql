-- Product photo per (set, product_type), same reference-data shape as
-- price_eur on this table (public read, only ever written by the
-- sync-sealed-product-prices script) — hotlinked TCGplayer CDN URL, same
-- convention as sync-tcgplayer-images.ts's card images (no auth needed,
-- unlike PokeWallet's set-logo backfill which had to re-host).
ALTER TABLE public.sealed_product_prices ADD COLUMN image_url text;
