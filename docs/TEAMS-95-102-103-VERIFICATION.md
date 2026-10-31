# Teams rows 95 / 102 / 103 — October 31, 2026

## Status and environment
All three rows are **partial**, not acceptance-complete. Frontend/query fixes are implemented. Authoritative repair is retained as `tests/database/teams_metric_boundary.pending.sql`, applied only to a disposable local database. It is **not applied to the shared backend**: this task authorizes disposable environments only, and no confirmed disposable migration-tool target is available. No shared reads or writes were used for acceptance.

## Defects and fixes
- Caller-keyed My teams/management RPC responses lacked actual caller validation. New helper checks authenticated identity before and after reading and checks abort state. Regression rejects switched-account/late results before cache insertion.
- Workspace fallback synthesized inherited leader/admin from event capability. Removed it; active-team selection checks direct access, persists in caller profile, and prefers actual owner rather than legacy role label.
- Owner counts lacked exact-team roster destinations; list mixed historical statuses with counts. Members/Requests buttons carry team ID and roster, named sheet opens only selected roster, and identical approved/pending filters determine count and list. Coach Event insights remains sole-owner managed; private events are nonlinked, public events link to public detail.
- Leader insight query lacked caller key and retained metrics during authorization error/refetch. Added identity key/guards, zero retention and loading-only rechecks. Consent/removal cancels/removes insight data and sends payload-free local-tab boundary signals. Remote sessions recheck every three seconds; disconnected devices cannot guarantee immediate removal of previously viewed information.
- Sharing now has selected-metric preview and explicit one-action revoke without saving unrelated checkbox changes. Joining itself creates no consent. EN/Latin American Spanish matched keys.
- Local pre-fix SQL assertion failed: `cancelled and merged attendees must not inflate opted-in check-ins`. Pending repair counts 2, not cancelled plus-ones or merged rows.
- Existing helper omitted suspension checks and insights bypassed stricter owner helper. Pending SQL uses authoritative direct channel/member access and sole-owner guard; local suspended leader/community target direct calls fail.
- Old consent survived removal/rejoin. Pending membership trigger resets consent; local rejoin reads empty. Shared backend remains unchanged, so this repair is not claimed live.

## Evidence
- Focused: 4 files, **23 passing tests** (team-membership, team-metrics, team-query-boundary, personal-cache).
- Full: **126 files / 990 tests**, exit 0.
- Automatic typecheck/build: `build OK` after optional roster typing fix. No separately invoked manual production build; harness compiler used.
- Disposable PostgreSQL 17, local port 55436: minimal empty tables and actual repository functions from 0150/0153/0204 plus pending SQL. Two leaders, a coach in both teams, pending/outsider/empty principals. Assertions cover caller teams, saved account selection, exact roster, per-team metrics, aggregate projection, revocation/rejoin, suspended leader/community member and signed-out/outsider direct calls. Transaction passed after repair, then rolled back.
- This is **not full-schema/authenticated RLS acceptance**: the test used a local database owner and minimal fixture tables. Existing RLS policies were installed but role-level positive/negative paths through the real app were not exercised.
- Actual TeamMetricSharing component in separate local Vite harness, fake responses only: save/stop/preview EN/ES at **320, 390, 1280**. Compiled app CSS, screenshots reviewed, no overflow or page errors. No real login or complete Teams navigation claimed.

## Remaining per row
- **95:** apply pending SQL through migration tool against a confirmed disposable target; full role/RLS isolation, event direct IDs, customer-data boundary and remote multi-session revocation acceptance.
- **102:** real My teams refresh/fresh login/back-forward/mode/account/concurrent-tab acceptance. Helper tests do not establish actual auth persistence.
- **103:** complete sole-leader Team → Members → coach → Event insights browser journey, membership transitions and event-management denial in full isolated app.
- Weak-network/error/retry, keyboard/screen-reader/physical-device and remote concurrent-tab acceptance incomplete. No event-management permission, affiliate/customer/purchase relation, fee or launch flag changed.

## Cleanup and revision
Profiles, teams, team_members, team_join_requests, team_metric_shares, events and rsvps each read **0** after rollback. Local database stopped; exact temporary database, harness, scripts, screenshots, sessions/logs removed. Intentional source/tests/docs remain; no shared fixtures existed.

No manual Git commit created: platform manages revisions. Observed code checkpoint `af090d6`; this is not asserted to include subsequent documentation edits. Final platform revision may differ.