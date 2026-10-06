REVOKE ALL ON FUNCTION public.is_event_cohost(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_event_cohost(uuid) TO authenticated;