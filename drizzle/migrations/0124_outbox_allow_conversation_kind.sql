-- Replies and @mentions in team/event conversations enqueue kind 'conversation'; the outbox check rejected it, so those posts failed.
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check
  CHECK (kind = ANY (ARRAY['transactional','reminders','announcements','badges','followups','automation','conversation']));