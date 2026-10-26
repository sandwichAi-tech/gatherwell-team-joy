REVOKE EXECUTE ON FUNCTION public.course_access_start(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.course_access_start(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.learn_object_unlocked(text) FROM public;