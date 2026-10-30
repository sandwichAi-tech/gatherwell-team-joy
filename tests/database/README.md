# Manual, disposable-copy database regression

`website_notes_disposable.sql` covers coach-scoped verified consent, pending anonymous requests, token rejection/unsubscribe, aggregate isolation, resource enrollment save/readback, in-app delivery idempotency, archive stopping and notification/RLS ownership. It was explicitly run on an isolated local PostgreSQL fixture schema with migrations 0104–0109 on 2026-10-25; all assertions passed and fixtures rolled back. This is not proof of shared-preview browser enrollment or hosted provider delivery. Use the same independently verified disposable destination and opt-in guard below; never wire it into the ordinary automated suite.

`prompt2_rls_disposable.sql` is created-only until it is run on an isolated writable database copy with the full application schema through migration 0050. It is not an application migration, not part of Vitest, and must never run automatically or manually against the production/shared preview database.

1. Provision a disposable PostgreSQL copy containing this application's schema, auth helpers, roles, grants, policies, and all migrations. Disable external workers/schedules/provider sends for the copy outside this test. Do not point at production or the shared preview database.
2. Use a privileged copy-only connection that can insert test auth users, create temp objects, and `SET ROLE authenticated/service_role`.
3. Set `DISPOSABLE_DATABASE_URL` privately to that copy's connection URL. Do not print it or commit it.
4. Run explicitly:

```bash
PGOPTIONS='-c app.disposable_database=YES' psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f tests/database/prompt2_rls_disposable.sql
```

The opt-in setting is a guard, not a detector of production: independently verify the destination. Success must exit 0 and print the rollback message. On any assertion error, `ON_ERROR_STOP` exits, disconnecting the connection and rolling back the open transaction. Do not continue the failed session or commit. Destroy the disposable copy afterward. PostgreSQL identity sequences can advance despite rollback; this is another reason not to run on production. Real RLS/triggers remain enabled; generated side-effect rows roll back with fixtures.

Coverage: exact fixture visibility for host, unrelated host, assigned event co-host/offer manager/track manager, unassigned team leader, attendee, and service role; unrelated/leader RSVP UPDATE and DELETE affect zero rows, with privileged read-back; linked-offer host track access; Spanish waiver hash. No claim is made that created-only SQL passed execution. Fixture-trigger compatibility and service-role behavior remain unverified until executed on the copy.
`registration_guardian_disposable.sql` (created 2026-10-24) covers the registration and guardian rules verified live against the preview backend on the same date: the rsvp_event_minor ambiguous-column fix (0056), capacity/waitlist ordering and promotion, waitlist-disabled full events, the terms gate, and the paid-tier gate. Same rules: disposable copy only, explicit opt-in, everything rolls back. Its live-preview counterparts passed against real fixtures on 2026-10-24; this file is created-only until executed on a disposable copy.
`referral_membership_disposable.sql` (2026-10-30) covers affiliate invite/request/approve/decline/remove, fail-closed terms acceptance, link/click/reward gating before and after removal, kept history and membership row isolation. It passed on a throwaway local PostgreSQL with stub stand-ins for app tables (not the full app schema), then rolled back.
