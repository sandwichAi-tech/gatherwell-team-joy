# Manual, disposable-copy database regression

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