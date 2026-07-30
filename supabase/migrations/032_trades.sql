-- Trading: 1-for-1 card swaps between friends, built on top of the existing
-- user_owned_cards.quantity ledger (migration 028), which already tracks
-- spare duplicates per card.
--
-- No new RLS needed on user_owned_cards/user_wishlist for friend visibility —
-- migration 022 (friendships) already extended user_wishlist's SELECT policy
-- to self/public/friend, and migration 029 already did the same for
-- user_owned_cards. Both are already exactly what trade matching needs.

CREATE TABLE public.trade_offers (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id        uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id        uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offered_card_id    text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  requested_card_id  text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  status             text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at         timestamptz  NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  CHECK (proposer_id <> receiver_id)
);

CREATE INDEX trade_offers_proposer_id_idx ON public.trade_offers (proposer_id);
CREATE INDEX trade_offers_receiver_id_idx ON public.trade_offers (receiver_id);

ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_offers_select_party" ON public.trade_offers
FOR SELECT USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

CREATE POLICY "trade_offers_insert_proposer" ON public.trade_offers
FOR INSERT WITH CHECK (auth.uid() = proposer_id AND public.are_friends(auth.uid(), receiver_id));

-- Only two safe self-service transitions that don't touch quantities: the
-- proposer withdrawing their own pending offer, or the receiver declining it.
-- Acceptance always goes through accept_trade_offer() below, never a plain UPDATE.
CREATE POLICY "trade_offers_cancel_own_pending" ON public.trade_offers
FOR UPDATE USING (auth.uid() = proposer_id AND status = 'pending')
WITH CHECK (status = 'cancelled');

CREATE POLICY "trade_offers_decline_received_pending" ON public.trade_offers
FOR UPDATE USING (auth.uid() = receiver_id AND status = 'pending')
WITH CHECK (status = 'declined');

-- Atomically swaps one card each way and marks the offer accepted. SECURITY DEFINER
-- (same convention as handle_new_user, migration 006) so it can move quantities
-- between both users' rows in one transaction — RLS alone can't grant that since
-- each user's UPDATE policy only ever covers their own rows.
CREATE OR REPLACE FUNCTION public.accept_trade_offer(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_offer public.trade_offers%ROWTYPE;
  v_proposer_qty int;
  v_receiver_qty int;
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

  SELECT quantity INTO v_proposer_qty FROM public.user_owned_cards
    WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  SELECT quantity INTO v_receiver_qty FROM public.user_owned_cards
    WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;

  IF COALESCE(v_proposer_qty, 0) < 1 OR COALESCE(v_receiver_qty, 0) < 1 THEN
    RAISE EXCEPTION 'insufficient_quantity';
  END IF;

  -- Proposer loses the offered card, gains the requested card.
  IF v_proposer_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.proposer_id AND card_id = v_offer.offered_card_id;
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, quantity)
    VALUES (v_offer.proposer_id, v_offer.requested_card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  -- Receiver loses the requested card, gains the offered card.
  IF v_receiver_qty = 1 THEN
    DELETE FROM public.user_owned_cards WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;
  ELSE
    UPDATE public.user_owned_cards SET quantity = quantity - 1
      WHERE user_id = v_offer.receiver_id AND card_id = v_offer.requested_card_id;
  END IF;
  INSERT INTO public.user_owned_cards (user_id, card_id, quantity)
    VALUES (v_offer.receiver_id, v_offer.offered_card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_owned_cards.quantity + 1;

  UPDATE public.trade_offers SET status = 'accepted', responded_at = now() WHERE id = p_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_trade_offer(uuid) TO authenticated;
