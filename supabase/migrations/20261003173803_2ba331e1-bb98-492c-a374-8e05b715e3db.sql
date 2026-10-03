REVOKE ALL ON public.rsvps FROM anon;
GRANT INSERT ON public.rsvps TO anon;
REVOKE ALL ON public.profiles, public.teams, public.team_members, public.activity FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.activity FROM authenticated;