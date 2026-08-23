-- Insert/delete a binder slot with position shifting — distinct from
-- swap_binder_slots (050, moves exactly two positions) and from clearing a
-- slot's content (no position change at all). Converts the plain unique
-- index on (collection_id, position) into a DEFERRABLE unique constraint so
-- insert_binder_slot/delete_binder_slot can shift many rows in one UPDATE
-- without a transient collision — the naive per-row check a plain index does
-- would reject a bulk shift mid-statement. swap_binder_slots is unaffected:
-- DEFERRABLE INITIALLY IMMEDIATE still checks immediately unless a
-- transaction explicitly defers, which only the two functions below do.
DROP INDEX public.user_collection_items_position_idx;
ALTER TABLE public.user_collection_items
  ADD CONSTRAINT user_collection_items_position_key UNIQUE (collection_id, position) DEFERRABLE INITIALLY IMMEDIATE;

-- Frees up p_position by shifting everything at or after it by +1 — creates
-- no row itself, the freed position is just an empty "+" tile filled via the
-- normal picker flow afterward. SECURITY INVOKER (default): the internal
-- UPDATE stays subject to the existing user_collection_items_update_self
-- RLS policy (042), same reasoning as swap_binder_slots.
CREATE OR REPLACE FUNCTION public.insert_binder_slot(p_collection_id uuid, p_position int)
RETURNS void LANGUAGE plpgsql AS $insert_binder_slot$
BEGIN
  SET CONSTRAINTS user_collection_items_position_key DEFERRED;
  UPDATE public.user_collection_items
  SET position = position + 1
  WHERE collection_id = p_collection_id AND position >= p_position;
END;
$insert_binder_slot$;

-- Removes whatever is at p_position (if anything — deleting an already-empty
-- position is valid, it still collapses the gap) and shifts everything after
-- it down by -1. Distinct from remove_binder_slot-equivalent client mutation
-- (useRemoveBinderSlot), which only clears content and leaves position gaps.
CREATE OR REPLACE FUNCTION public.delete_binder_slot(p_collection_id uuid, p_position int)
RETURNS void LANGUAGE plpgsql AS $delete_binder_slot$
BEGIN
  SET CONSTRAINTS user_collection_items_position_key DEFERRED;
  DELETE FROM public.user_collection_items WHERE collection_id = p_collection_id AND position = p_position;
  UPDATE public.user_collection_items
  SET position = position - 1
  WHERE collection_id = p_collection_id AND position > p_position;
END;
$delete_binder_slot$;
