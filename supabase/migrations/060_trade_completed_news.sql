-- Posts a friend_news 'trade_completed' event for both sides the moment a
-- trade actually completes (both confirmations in) — this RPC (latest body
-- from 046_trade_offers_finish_scoping.sql) is the single reliable point that
-- transition happens server-side, so there's no client-side race between
-- whichever side confirms second.
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

  INSERT INTO public.friend_news (user_id, event_type, trade_offer_id) VALUES (v_offer.proposer_id, 'trade_completed', p_offer_id);
  INSERT INTO public.friend_news (user_id, event_type, trade_offer_id) VALUES (v_offer.receiver_id, 'trade_completed', p_offer_id);
END;
$confirm_trade_exchange$;
