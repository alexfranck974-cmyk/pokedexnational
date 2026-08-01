-- Full row data on UPDATE events (payload.old) needed for the extended
-- notification system (lib/notifications.ts) to detect trade_offers status
-- transitions (pending -> in_progress -> completed) — by default Postgres
-- only includes primary-key columns in the "old" record for logical
-- replication, so payload.old.status would otherwise be undefined.
ALTER TABLE public.trade_offers REPLICA IDENTITY FULL;
