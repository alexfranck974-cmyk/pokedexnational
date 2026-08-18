-- 048's backfill populated set_releases with every already-known set, timestamped
-- "now" — which means every EXISTING user, having dismissed nothing yet, would
-- see all ~222 of them as "new" on their next Dashboard visit. Mark them as
-- already-seen for every current user, the same way 048 marked the sets
-- themselves as already-known for the trigger.
INSERT INTO public.set_releases_dismissed (set_id, user_id)
SELECT sr.set_id, p.id
FROM public.set_releases sr
CROSS JOIN public.profiles p
ON CONFLICT (set_id, user_id) DO NOTHING;
