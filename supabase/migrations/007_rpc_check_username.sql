CREATE OR REPLACE FUNCTION public.check_username_available(candidate text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(candidate));
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
