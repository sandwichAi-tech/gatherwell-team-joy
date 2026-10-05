REVOKE EXECUTE ON FUNCTION public.add_walk_in(uuid,text,text,text,text,boolean,boolean,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_in_rsvp(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_poll(uuid,text,text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.event_summary(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_in_code(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_walk_in(uuid,text,text,text,text,boolean,boolean,text), public.check_in_rsvp(uuid,boolean), public.create_poll(uuid,text,text[]), public.event_summary(uuid), public.check_in_code(uuid,text) TO authenticated, service_role;