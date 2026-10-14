CREATE POLICY "People read gatherings they RSVPd to" ON public.events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = events.id AND r.user_id = auth.uid()));