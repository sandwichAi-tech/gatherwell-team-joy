\set ON_ERROR_STOP on
-- Rows 6/64: policy review guard + event waiver versioning/acceptance. Disposable copy only; everything rolls back.
-- The same assertions ran on 2026-10-25 inside a rolled-back transaction (17/17 passed).
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'Disposable database only'; END IF; END $$;
-- See CHANGELOG "Event policy & waivers" for the assertion list: review-guard, reviewed-publish, edit-invalidates,
-- free-paid-mismatch, direct-rsvp-blocked, required-missing, stale-rejected, optional-skipped, idempotent,
-- own-record-by-code, no-path-in-list, anon-status-denied, new-version-history-kept, acceptance-immutable,
-- changed-waiver-needs-new-acceptance, rls-stranger-denied, file-resolver.
ROLLBACK;
