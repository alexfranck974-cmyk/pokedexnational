-- Trade "in progress" + double confirmation: accepting a trade offer no
-- longer swaps cards immediately — it only marks the trade as in_progress.
-- Ownership only actually moves once BOTH the proposer and the receiver
-- separately confirm the real-world exchange happened (met up, mailed the
-- cards, etc).

-- Existing 'accepted' rows were completed under the old atomic-swap-on-accept
-- logic — relabel them 'completed' so the status vocabulary stays meaningful
-- going forward (pending -> in_progress -> completed, or declined/cancelled).
ALTER TABLE public.trade_offers DROP CONSTRAINT trade_offers_status_check;
UPDATE public.trade_offers SET status = 'completed' WHERE status = 'accepted';
ALTER TABLE public.trade_offers ADD CONSTRAINT trade_offers_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'declined', 'cancelled'));

ALTER TABLE public.trade_offers ADD COLUMN proposer_confirmed_at timestamptz;
ALTER TABLE public.trade_offers ADD COLUMN receiver_confirmed_at timestamptz;
ALTER TABLE public.trade_offers ADD COLUMN completed_at timestamptz;

-- Receiver accepting now only starts the in-person exchange — it no longer
-- moves any cards. Replaces the old version that swapped immediately.
CREATE OR REPLACE FUNCTION public.accept_trade_offer(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $accept_trade_offer$
DECLARE
  v_offer public.trade_offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.trade_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trade_offer_not_found';
  END IF;
  IF v_offer.status <> 'pending' THEN
    RAISE EXCEPTION 'trade_offer_not_pending';
  END IF;
  IF auth.uid() <> v_offer.receiver_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.trade_offers SET status = 'in_progress', responded_at = now() WHERE id = p_offer_id;
END;
$accept_trade_offer$;

-- Called by either party once the real-world exchange actually happened.
-- Records that side's confirmation, and only swaps quantities once BOTH
-- sides have confirmed — SECURITY DEFINER for the same reason as before
-- (needs to touch both users' user_owned_cards rows in one transaction).
CREATE OR REPLACE FUNCTION public.confirm_trade_exchange(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $confirm_trade_exchange$
DECLARE
  v_offer public.trade_offers%ROWTYPE;
  v_proposer_qty int;
  v_receiver_qty int;
BEGIN
  SELECT * INTO v_offer FROM public.trade_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trade_offer_not_found';
  END IF;
  IF v_offer.status <> 'in_progress' THEN
    RAISE EXCEPTION 'trade_offer_not_in_progress';
  END IF;
  IF auth.uid() <> v_offer.proposer_id AND auth.uid() <> v_offer.receiver_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF auth.uid() = v_offer.proposer_id THEN
    UPDATE public.trade_offers SET proposer_confirmed_at = COALESCE(proposer_confirmed_at, now()) WHERE id = p_offer_id;
  ELSE
    UPDATE public.trade_offers SET receiver_confirmed_at = COALESCE(receiver_confirmed_at, now()) WHERE id = p_offer_id;
  END IF;

  SELECT * INTO v_offer FROM public.trade_offers WHERE id = p_offer_id;
  IF v_offer.proposer_confirmed_at IS NULL OR v_offer.receiver_confirmed_at IS NULL THEN
    RETURN; -- waiting on the other side
  END IF;

  -- Both sides confirmed — execute the swap (same logic the old
  -- accept_trade_offer used to run immediately on accept).
  SELECT quantity INTO v_proposer_qty FROM public.user_owned_cards
    WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  SELECT quantity INTO v_receiver_qty FROM public.user_owned_cards
    WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;

  IF COALESCE(v_proposer_qty, 0) < 1 OR COALESCE(v_receiver_qty, 0) < 1 THEN
    RAISE EXCEPTION 'insufficient_quantity';
  END IF;

  IF v_proposer_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, quantity)
    VALUES (v_offer.proposer_id, v_offer.requested_card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  IF v_receiver_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, quantity)
    VALUES (v_offer.receiver_id, v_offer.offered_card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  UPDATE public.trade_offers SET status = 'completed', completed_at = now() WHERE id = p_offer_id;
END;
$confirm_trade_exchange$;

GRANT EXECUTE ON FUNCTION public.confirm_trade_exchange(uuid) TO authenticated;
