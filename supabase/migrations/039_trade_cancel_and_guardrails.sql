-- 1. Either party can back out of an in-progress trade (accepted but not yet
-- confirmed by both sides) before it's finalized — no quantities have moved
-- yet at this stage, so a plain status flip is all that's needed (same
-- pattern as the existing pending cancel/decline policies, no RPC required).
CREATE POLICY "trade_offers_cancel_in_progress" ON public.trade_offers
FOR UPDATE USING (
  (auth.uid() = proposer_id OR auth.uid() = receiver_id) AND status = 'in_progress'
) WITH CHECK (status = 'cancelled');

-- 2. Guardrails on proposing a trade:
--    a) you must actually own at least one copy of what you're offering
--    b) you can't have more simultaneous active offers (pending/in_progress)
--       referencing the same card than you actually own copies of — without
--       this, offering your one unique copy to two friends at once would let
--       both proposals sit "valid" until one of them fails at confirm time
--       with a confusing insufficient_quantity error.
CREATE OR REPLACE FUNCTION public.check_trade_offer_ownership()
RETURNS trigger LANGUAGE plpgsql AS $check_trade_offer_ownership$
DECLARE
  v_owned_qty int;
  v_committed_count int;
BEGIN
  SELECT quantity INTO v_owned_qty FROM public.user_owned_cards
    WHERE user_id = NEW.proposer_id AND card_id = NEW.offered_card_id;
  IF COALESCE(v_owned_qty, 0) < 1 THEN
    RAISE EXCEPTION 'proposer_does_not_own_offered_card';
  END IF;

  SELECT count(*) INTO v_committed_count FROM public.trade_offers
    WHERE proposer_id = NEW.proposer_id AND offered_card_id = NEW.offered_card_id
      AND status IN ('pending', 'in_progress');
  IF v_committed_count >= v_owned_qty THEN
    RAISE EXCEPTION 'offered_card_already_committed';
  END IF;

  RETURN NEW;
END;
$check_trade_offer_ownership$;

CREATE TRIGGER trade_offers_check_ownership
BEFORE INSERT ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.check_trade_offer_ownership();
