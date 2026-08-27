-- Self-service account deletion — required by both Apple (Guideline 5.1.1(v))
-- and Google Play for any app with account creation, ahead of store
-- submission. No Edge Function needed (this project has no Supabase CLI
-- workflow set up, everything ships via the SQL Editor) — a SECURITY
-- DEFINER Postgres function reaches auth.users directly, which a plain
-- authenticated client has no privilege on. Scoped to auth.uid() so it can
-- never delete anyone but the caller. Deleting the auth.users row cascades
-- to profiles (ON DELETE CASCADE, 001_profiles.sql) and from there to every
-- other user-owned table already wired the same way — nothing else to clean
-- up manually.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
