# Security notes

Reviewed October 2026. Every open scanner note is either fixed or listed here with why it stays.

## Fixed in this review
- Signed-out visitors can no longer call host-only actions: add_walk_in, check_in_rsvp, check_in_code, create_poll, event_summary.
- Every security-definer function already has a fixed search_path (verified: none missing).

## Intentionally left in place
- site_media table readable by anyone: holds only public marketing photo slots (no personal data).
- site-media storage readable by anyone: public marketing images, the one allowed exception to private buckets.
- Signed-out callable functions (15): get_public_event, event_price, rsvp_event, get_rsvp_by_code, update_rsvp_by_code, cancel_rsvp_by_code, vote_poll, my_poll_votes, get_team_invite, get_email_prefs, set_email_prefs, list_public_gatherings, landing_social_proof, report_content, can_view_event — the guest page, invite page, unsubscribe page and landing page need them; they return initials only, require a private code/token for personal rows, and rsvp_event is rate limited (10/min).
- Signed-in callable security-definer functions (78): each checks the caller's team role (is_team_member / has_role) inside before doing anything; definer rights are needed to avoid recursive RLS.
- Tables with RLS on and no policies (8: app_config, delivery_events, email_prefs, email_suppressions, library_chunks, member_plans, sms_optouts, stripe_events): only the app's own server reaches them, so no client access is the intent.
- vector extension in public schema: required by library search; moving it would break existing columns.

## Confirmed
- RLS is enabled on every public table.
- Uploaded photos (media, event-photos, challenge-photos) are private and shown via signed URLs.
- No secret keys in front-end code; all provider keys are read in server functions.
- Admin actions are checked on the server (has_role) and audited.
- Rate limits: RSVP (database, 10/min), assistant (monthly plan quota), reports (custom database limit, five per rolling minute per signed-in person or guest IP; transaction advisory lock prevents concurrent requests exceeding the limit).
