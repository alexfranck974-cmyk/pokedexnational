-- Binder slots can now optionally track a finish (normal/holo/reverse_holo),
-- letting the same card_id occupy two distinct slots in one binder — one per
-- finish — so a "master set" binder can hold both the normal and reverse-holo
-- print of every card as separate checklist items. Nullable because image
-- slots (card_id IS NULL, see 043) have no finish concept at all — mirrors
-- how image_url/card_id already split the row into two disjoint shapes via
-- user_collection_items_content_check.
ALTER TABLE public.user_collection_items ADD COLUMN finish text;

-- Backfill BEFORE the CHECK below — an unbackfilled NULL on a card_id-holding
-- row would fail CHECK validation immediately at ADD CONSTRAINT time.
UPDATE public.user_collection_items SET finish = 'normal' WHERE card_id IS NOT NULL;

-- Same shape as user_collection_items_content_check (043): finish is required
-- exactly when card_id is present, never otherwise. Value domain mirrors
-- user_owned_cards.finish (045).
ALTER TABLE public.user_collection_items ADD CONSTRAINT user_collection_items_finish_check
  CHECK ((card_id IS NOT NULL) = (finish IS NOT NULL) AND (finish IS NULL OR finish IN ('normal', 'holo', 'reverse_holo')));

-- DEFAULT only matters going forward — useAssignCardToSlot (lib/binders.ts)
-- inserts card_id without ever specifying finish, so this alone gives every
-- future manually-picked slot 'normal' with zero code change there.
ALTER TABLE public.user_collection_items ALTER COLUMN finish SET DEFAULT 'normal';

-- Widen the "no duplicate card in one binder" guarantee (043) to be per-finish
-- instead of per-card — the whole point of this feature: the same card_id can
-- now occupy two slots (normal + reverse_holo) in the same binder.
DROP INDEX public.user_collection_items_card_unique_idx;
CREATE UNIQUE INDEX user_collection_items_card_unique_idx
  ON public.user_collection_items (collection_id, card_id, finish) WHERE card_id IS NOT NULL;
