> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

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

## Update — Prompt 2 foundation (2026-10-23, active)
- Team leaders no longer read guest RSVPs, answers, waiver records or event outbox; only hosts and assigned co-hosts do. Text-invite candidates limited to the caller's own hosted/co-hosted events.
- Signed-out callers can no longer run 19 functions (10 trigger-only, 9 signed-in-only). 58 public-callable security-definer functions remain, mostly guest RPCs; the full allowlist review is pending.
- New versioned fee, price, consent, refund and payout policy tables; orders ledger, entitlements and provider event log exist but are not yet used by checkout.

## Prompt 2 corrective evidence — 2026-10-23 (active)

### Independently supplied database verification, not rerun by this agent
The requester supplied the following results after commit ac2eef3c5d5ff7138522b81254c348b35d9ca72d. These supersede the earlier lack-of-role-evidence note; attribution is preserved.

| Authenticated account | RSVPs | Waiver acceptances | Event outbox |
|---|---:|---:|---:|
| Host 97964c37-afbf-4166-83ca-689bf72df4c0, own offerings | 8 | 7 | 10 |
| Unrelated host 57c4cd39-5305-4daf-89fd-186c1ab2ce85 | 0 | 0 | 0 |
| Unassigned team leader 43c560ea-fd8b-4398-b12d-7c2b6af14bcd | 0 | 0 | 0 |
| Attendee 49249434-e598-4d1b-a95c-e3f3d82d31c7 | exactly own 1 | not reported | not reported |

- In a transaction rolled back by the independent tester, assigning the unrelated host as co-host of the tested event exposed 7 RSVPs and 7 waivers for that event; outbox was not reported for this case.
- In rolled-back transactions, unrelated host and unassigned leader each affected 0 rows attempting direct RSVP UPDATE and DELETE.
- No independent evidence was supplied for service role, course/offer managers, other roles, or other participant tables. No claim is made that they passed.

### This turn's verified correction
- 0049 applied: environment required on future orders (validated CHECK), environment/key uniqueness replaces the global key constraint, exact offering/kind target constraints validated, all seven profile FKs added with zero orphan references. Orders host/buyer SET NULL; manager users/entitlement users CASCADE, assigners SET NULL. A server trigger requires a host on future host sales while permitting FK anonymization after profile deletion; buyer remains nullable.
- Linked-offer hosts and explicit track managers can access track participants; leadership is not a branch of that function.
- 7/7 acceptances backfilled by team/version and RSVP language, all English in current rows, 0 unmatched. Server triggers own exact version/hash, capture later waiver text versions, and prevent mutation of referenced consent text. 0050 applied only after read-back: both snapshot columns now NOT NULL.
- Feature flag INSERT/UPDATE/DELETE now append old/new, actor, optional transaction reason/source, and time to config_versions. No flag was changed; config_versions remains 0 rows. Ordinary roles have no direct write grants; existing read policy retained.
- Manual SQL regression created at tests/database/prompt2_rls_disposable.sql with explicit disposable-copy instructions. It was NOT executed: no isolated writable copy was available. Production/preview fixtures were not created.
- Full existing automated suite: 19 files / 96 tests passed twice, including all eight fee tests. SQL runtime assertions are created-only, not counted as passing automated checks.
- Linter 262 findings: 10 no-policy, 1 public extension, 58 anonymous definer, 193 authenticated definer; unchanged from prior turn, vs documented Prompt 0 baseline 286 (77 anonymous). Prompt 0 baseline is documentary, not rerun here.
- Strict literal no-DROP/no-TRUNCATE scan has a disclosed exception: DROP CONSTRAINT orders_idempotency_key_key is necessary for scoped uniqueness. TRUNCATE appears only as a revoked privilege, not an operation. No DROP TABLE/COLUMN/SCHEMA/DATABASE, TRUNCATE operation, or business DELETE exists in the new migrations.
- Pre/post read-only counts unchanged: events 15, RSVPs 8, waivers 7, outbox 40, offers 2; orders/entitlements/managers/tracks/payments/config history all 0. Nine flag values and timestamps unchanged. Counts alone do not prove every field unchanged; migration SQL performs only the requested consent backfill.

### Unverified and recovery
- Created-only SQL role, invalid-order/entitlement, FK deletion/anonymization, future acceptance/flag trigger, and service-role behavior need execution against a disposable copy. No browser, mobile/desktop, accessibility, payment or provider flow was exercised; this change has no presentation code.
- SOURCE_OF_TRUTH.md and active rule documents unchanged. Dedicated hosted Project Knowledge field was not fetched in this turn; supplied Project Knowledge remains the controlling context, not newly API-verified.
- Forward repair is preferred: append corrective functions/constraints if copy testing discovers an issue. Preserve all consent snapshots and economic rows. Do not reset data or edit applied migration history; restoring global key uniqueness requires first inspecting cross-environment duplicate keys and must not delete orders.

## Prompt 3 — identity (2026-10-23)
- Return paths: src/lib/return-to.ts and public.is_safe_return_path() share one allowlist; schemes, //, backslashes, %-encoding, controls, `..`, `#`, >512 chars and unlisted routes are rejected.
- auth_intents stores only SHA-256 of a random 48-hex token; 30-minute expiry, single use, expired rows purged on each create (cleanup_auth_intents() for jobs). No raw tokens or emails are logged.
- claim_guest_records() reads the verified email from auth.users for auth.uid(), takes an advisory lock, touches only user_id-null unmerged rows, never deletes, logs every claim/merge in guest_claims, and creates no orders or entitlements.
- 18+ is enforced by triggers (teams, events create/publish, offers) and in checkout server functions; service jobs (no auth.uid()) are exempt.
- Known gap: is_adult(uuid) lets a signed-in user check another user's adult flag (boolean only).
- update_event_details() is guarded by can_manage_event() and validates every new field server-side (format, language, reg window order, min age 0-17, https map link, email shape, tag/tier/addon caps).
- rsvp_event_minor() validates allows_minors, min age band, guardian name/relationship/contact server-side; the guardian consent version is resolved from consent_text_versions in the database, never chosen by the client; the existing guard_minor_registration trigger re-validates on insert/update.
- enforce_reg_window() blocks guest RSVPs outside the registration window for every RSVP path; host walk-ins bypass it.
- get_public_event() exposes the new public-safe fields only; online join URLs stay out of the public payload.

## Registration (2026-10-24)
- register_attendance() is the single guest/account registration path: platform terms consent is required and its version is resolved from consent_text_versions in the database, never chosen by the client; paid tiers raise payment_required until checkout is configured; tier quantity and sale windows are checked under the event row lock, so capacity stays atomic.
- rsvp_event() raises event_full when a full event has the waitlist disabled; a transaction-local flag (gw.force_waitlist) lets tier-level capacity waitlist through the same locked path.
- host_cancel_rsvp() requires can_manage_event(), keeps the row (cancelled_by + reason), and the existing rsvp_freed trigger promotes the next waitlisted guest; notifications are queued, not claimed delivered.
- my_tickets() returns only the caller's own registrations and exposes the virtual join link only while the registration is active; guest management stays behind the opaque checkin code.

## Registration verification (2026-10-24, live pass)
- Concurrency: the event row lock serializes last-seat races — two simultaneous registrations produced exactly one confirmation and one waitlist.
- rsvp_event_minor() had an ambiguous `status` reference (OUT param vs events column) that failed every guardian registration; fixed in 0056 by qualifying the column. Any future RETURNS TABLE function touching events must qualify `status`.
- Guest management is bound to the opaque 24-char checkin code: tampered/short codes are rejected and there is no email-only lookup path (anon has no rsvps grant at all; authenticated non-hosts read zero rows via RLS).
- host_cancel_rsvp() is can_manage_event()-checked; cancellation keeps the row with cancelled_by + reason.
- my_tickets() exposes the virtual join link only for the caller's own active registrations.

## 2026-10-24 — Course/resource access (0057–0059)
- get_public_offer() exposes only metadata and lesson titles/types/durations for published public/unlisted offers — no file paths, URLs, or instructor notes.
- lesson_instructor_notes is editor-only via can_edit_track; learners have no read path.
- enroll_free is signed-in-only, window-enforced, idempotent; paid offers raise payment_required (no entitlement without verified payment).
- grant_offer_access resolves recipients server-side by exact confirmed email; unknown accounts return a neutral no_account (no enumeration); every grant writes offer_grants audit rows.
- Entitlement kind/source values must satisfy the existing entitlements CHECK constraints (course offers use course_subscription; sources free/admin).

## 2026-10-24 — Resource bundles (0060)
- offer_items: host-only writes; entitled learners read published current versions; anon has no grant.
- Bundle downloads are signed server-side per item (learn-media, 600s, attachment) after can_access_offer + allow_download + published/current checks; replaced versions are not downloadable.
- get_public_offer exposes bundle item metadata only (no storage_path, no URLs); verified live with leak checks.
- Download UI uses same-tab assignment to the attachment signed URL — no popup-blocker-prone window.open.

## 2026-10-24 — Course verification (0061)
- offer_readiness() 400'd on any blocker (array literal bug); fixed with array_append — no privilege change, still host-only via auth.uid() check.
- Re-verified live: anonymous /o/$id exposes metadata + lesson titles only (no content, paths, notes, emails); archiving an offer immediately removes public access; course fixtures fully removed after testing.
