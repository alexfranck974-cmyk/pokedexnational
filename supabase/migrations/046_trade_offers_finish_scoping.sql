-- user_owned_cards' PK widened to (user_id, card_id, finish) in migration 045 —
-- a plain "SELECT quantity ... WHERE user_id = ? AND card_id = ?" now returns
-- more than one row once a user owns two finishes of the same card, which
-- breaks the "SELECT ... INTO" single-row assumption these trade functions
-- rely on. Trades are scoped to the 'normal' finish only for now: you can
-- only propose/exchange your normal-finish copies. Trading a specific holo or
-- reverse holo copy is out of scope for this iteration.

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
    WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id AND finish = 'normal';
  SELECT quantity INTO v_receiver_qty FROM public.user_owned_cards
    WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id AND finish = 'normal';

  IF COALESCE(v_proposer_qty, 0) < 1 OR COALESCE(v_receiver_qty, 0) < 1 THEN
    RAISE EXCEPTION 'insufficient_quantity';
  END IF;

  IF v_proposer_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id AND finish = 'normal';
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id AND finish = 'normal';
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, finish, quantity)
    VALUES (v_offer.proposer_id, v_offer.requested_card_id, 'normal', 1)
    ON CONFLICT (user_id, card_id, finish) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  IF v_receiver_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id AND finish = 'normal';
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id AND finish = 'normal';
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, finish, quantity)
    VALUES (v_offer.receiver_id, v_offer.offered_card_id, 'normal', 1)
    ON CONFLICT (user_id, card_id, finish) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  UPDATE public.trade_offers SET status = 'completed', completed_at = now() WHERE id = p_offer_id;
END;
$confirm_trade_exchange$;

CREATE OR REPLACE FUNCTION public.check_trade_offer_ownership()
RETURNS trigger LANGUAGE plpgsql AS $check_trade_offer_ownership$
DECLARE
  v_owned_qty int;
  v_committed_count int;
BEGIN
  SELECT quantity INTO v_owned_qty FROM public.user_owned_cards
    WHERE user_id = NEW.proposer_id AND card_id = NEW.offered_card_id AND finish = 'normal';
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
