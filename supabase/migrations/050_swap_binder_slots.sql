-- Atomically swaps (or moves, if the target slot is empty) two binder slot
-- positions. The unique (collection_id, position) index (041) means a naive
-- two-step UPDATE would violate the constraint mid-swap — routed through a
-- sentinel position (-1, outside the valid [0, binderSlotCount) range) so the
-- unique index is never violated at any intermediate step. SECURITY INVOKER
-- (default) is deliberate: each internal UPDATE stays subject to the existing
-- "user_collection_items_update_self" RLS policy (042), so ownership is
-- enforced by RLS rather than duplicated here.
CREATE OR REPLACE FUNCTION public.swap_binder_slots(p_collection_id uuid, p_position_a int, p_position_b int)
RETURNS void LANGUAGE plpgsql AS $swap_binder_slots$
BEGIN
  IF p_position_a = p_position_b THEN RETURN; END IF;
  UPDATE public.user_collection_items SET position = -1 WHERE collection_id = p_collection_id AND position = p_position_a;
  UPDATE public.user_collection_items SET position = p_position_a WHERE collection_id = p_collection_id AND position = p_position_b;
  UPDATE public.user_collection_items SET position = p_position_b WHERE collection_id = p_collection_id AND position = -1;
END;
$swap_binder_slots$;
