CREATE OR REPLACE FUNCTION public.normalize_attendance_notification_kind() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.kind='followups' THEN NEW.kind:='ticket'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_notification_kind BEFORE INSERT ON public.notifications FOR EACH ROW WHEN (NEW.kind='followups') EXECUTE FUNCTION public.normalize_attendance_notification_kind();