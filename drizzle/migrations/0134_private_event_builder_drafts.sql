CREATE TABLE public.event_builder_drafts(event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.event_builder_drafts TO authenticated;
GRANT ALL ON public.event_builder_drafts TO service_role;
ALTER TABLE public.event_builder_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_builder_draft_manager ON public.event_builder_drafts TO authenticated USING(public.can_manage_event(event_id)) WITH CHECK(public.can_manage_event(event_id));
COMMENT ON COLUMN public.events.builder_draft IS 'DEPRECATED: private snapshots use event_builder_drafts to prevent team-member access.';
CREATE OR REPLACE FUNCTION public.save_event_builder_draft(_team uuid, _event uuid, _snapshot jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _safe jsonb; _existing public.events;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(_snapshot) <> 'object' OR octet_length(_snapshot::text)>150000 THEN RAISE EXCEPTION 'invalid_draft'; END IF;
 IF _event IS NOT NULL THEN
  SELECT * INTO _existing FROM public.events WHERE id=_event;
  IF _existing.id IS NULL OR _existing.status <> 'draft' OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _id:=_event;
 ELSE
  IF NOT public.is_team_member(_team,ARRAY['leader','host']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _safe:=jsonb_build_object('title',coalesce(nullif(left(trim(_snapshot->>'title'),120),''),'Untitled event'),'starts_at',now()+interval '7 days','duration_minutes',60,'visibility','invite','capacity','','cover_style',0);
  _id:=public.create_gathering_at(_team,_safe,false,false);
 END IF;
 INSERT INTO public.event_builder_drafts(event_id,snapshot) VALUES(_id,_snapshot) ON CONFLICT(event_id) DO UPDATE SET snapshot=excluded.snapshot,updated_at=now();
 UPDATE public.events SET title=coalesce(nullif(left(trim(_snapshot->>'title'),120),''),title) WHERE id=_id AND status='draft';
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_event_builder_draft(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_event_builder_draft(uuid,uuid,jsonb) TO authenticated;