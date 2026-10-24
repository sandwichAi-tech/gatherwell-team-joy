
-- Allow automation-enqueued rows in the outbox kind check.
ALTER TABLE public.notification_outbox DROP CONSTRAINT notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check
  CHECK (kind IN ('transactional','reminders','announcements','badges','followups','automation'));
