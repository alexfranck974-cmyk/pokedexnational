-- Per-user order/visibility for the Dashboard's 4 "nebula" ring widgets
-- (goals/badges/trades/cards, see app/(app)/dashboard.tsx). Both NULL by
-- default — dashboard.tsx falls back to the original fixed order with
-- nothing hidden, so existing users see no change until they customize.
-- No RLS changes needed: profiles_update_self (005_rls.sql) already covers
-- self-updating any column on this row.
ALTER TABLE public.profiles ADD COLUMN dashboard_ring_order text[];
ALTER TABLE public.profiles ADD COLUMN dashboard_hidden_rings text[];
