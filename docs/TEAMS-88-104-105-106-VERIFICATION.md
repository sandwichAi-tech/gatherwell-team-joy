# Teams rows 88 / 104 / 105 / 106 — October 31, 2026

## Status and environment
All four rows remain **partially implemented / partially verified**, not acceptance-complete.
Application changes are in source. Authoritative SQL is retained in `tests/database/teams_library_invite_boundary.pending.sql`, **not applied to shared Cloud**: the authorized environment is disposable only, whereas the migration tool targets the shared backend. No customer data or shared fixture reads/writes were used.

## Exact changes

### Rows 88 / 104 — invitations and approval
- Join-code page now submits the code through `join_team_by_code`, rather than substituting a team-ID request after preview. Rotation is therefore checked at submission. Removed the legacy browser `by` attribution write and onboarding parameter; team invitation does not create referral/customer/payment relationships.
- Preview effects discard responses from a previous code; RPC errors show unavailable instead of leaving the previous preview. Pending convenience code is cleared on successful request, not merely because the viewer is signed in.
- Email-invite sign-in preserves its safe `/invite/team/<token>` return path; acceptance refreshes the caller's Teams/workspace queries and broadcasts a payload-free team change. Removed delayed navigation. Legacy admin values remain type-compatible, but neither role picker offers delegated admin.
- Pending SQL validates the optional invitation ID's team, verified email, expiry, revocation and usage. Acceptance retries no longer bypass those checks. Only the existing safe team/name/leader preview is returned; suspended teams/owners are excluded. Proposed role RPC patch rejects new delegated-admin assignment/invites, without rewriting existing memberships.
- Existing owner approve/decline/remove and code-rotation functions were reused; joining remains pending and grants no metrics or paid entitlement.

### Row 105 — explicit sharing and independent copies
- Library list/source reads now validate caller identity before and after each response; account/team changes reset open preview/share/copy state. Unsharing removes an open source preview on readback; matching local-tab signals close it immediately. Remote sessions poll every three seconds.
- Copy destination changes reset the retry key; destination is locked during submission and copy is unavailable during an access recheck/error.
- Pending SQL binds copy receipts to source team and destination; rejects null keys and mismatched retries. Legacy receipts are not silently rebound. Independent drafts remain after source unsharing.
- Pending SQL closes legacy direct `use_resource_template` and `save_resource_template` source-authorization bypasses, restricts source deletion to its author, and removes recursive ancestor template eligibility. Existing resource/event export allowlists remain unchanged: no participant, payment, consent/history or private-storage path copying.
- **Pre-fix evidence:** local actual-source-boundary test failed with `private source direct-ID export must be denied`. The same assertion passed after the pending repair.

### Row 106 — private announcements and chat
- Channel/list/feed/topic reads are caller-validated; comment/topic identities now include account. Mode-cache clearing includes comment/topic/unread/library states.
- Membership/focus/online/local-tab access rechecks hide private channel children immediately and close announcement editor; errors/null results do not render retained content. Ordinary successful polling does not continually unmount composers. Account/team switches reset editor/topic state.
- Default-visible announcements now use the same read predicate as the announced tab; read updates are gated on successful access/list and nonzero unread state. Mute does not mark chat read. Existing owner-only announcement/pin and direct-member chat RPCs remain.
- Narrow-screen mute label is constrained to the available width with a nonshrinking switch; EN/ES content fits at 320/390/1280 in the isolated screen harness.

## Evidence and limits
- Focused automated tests: **4 files / 46 passing tests** (communication, caller boundary, personal cache, return path). New regressions cover stalled focus/access recheck hiding private announcements, different-account read denial, mode clearing chat/library state, and safe invitation return paths. Full suite: **126 files / 994 passing tests**, exit 0.
- Automatic typecheck/production-build harness reported `build OK`; no manually invoked build/typecheck.
- Empty local PostgreSQL 17.9 cluster, private Unix socket `/tmp/teams-sprint-local`, port 55438 with TCP disabled. Seven ZZ-TEST principals, two unrelated owners, three workspaces, a coach in both teams, pending/approved/declined/removed/outsider/empty/suspended cases. Actual repository membership/library/copy/rotation/access functions installed on **minimal stand-in tables**, external notification/audit functions no-op. Resource instantiation/save bodies partly stand in for the much larger resource schema. This is not a full Cloud-compatible auth/storage database.
- Assertions: pending request/acceptance retry, verified-email/invalid-team/revoked-token denial, member approval/rotation denial, approved/removed/declined/outsider/suspended/signed-out channel/library access, private legacy source denial, independent unpublished copy/default private shares, authorized destination mismatch, null retry, unshare/new-copy denial, preserved prior draft, rotated-preview/code denial. Source DELETE was additionally exercised with **SET ROLE authenticated** and affected zero rows. Other calls were database-owner sessions with caller auth claims, **not full RLS acceptance**.
- Actual TeamCommunication screen in a separate Vite harness with mocked auth/RPC and actual locales/styles: EN and Latin American Spanish **320, 390, 1280**, revoke/restore/account switch/member owner-control absence passed with no page errors and no visible content extending beyond viewport. Harness-only controls and ZZ-TEST content are not production content. A switch focus-ring scroll-width artifact was excluded from the content-bound check; no full-page accessibility certification claimed.
- No complete signed-in application journey, browser persistence/relogin/back-forward, true concurrent authenticated tabs, invitation/library browser copy journey, direct file signing, provider sends or real notifications were exercised. A component harness is not a substitute for that acceptance pass.

## Remaining by row
- **88:** apply pending SQL to a confirmed disposable full-app backend; complete real sign-in/onboarding/invite preview/request/relogin, verified email and suspension/rotation races.
- **104:** full-schema RLS checks of owner invite/approve/decline/remove/rotation/revoke including concurrent requests, all legacy role RPCs and safe email-token preview. Proposed admin-role patch is static-reviewed, not positive local-tested against the full legacy role functions.
- **105:** actual full-type/resource/event instantiation, all stored-draft configurations, media rehoming, quiz/audio/agenda/waiver configuration completeness, entitlement/private signed-file direct-ID checks and copy customization/publish acceptance. Paid launch gates remain off. Legacy arbitrary JSON source content needs full-schema inspection before claiming complete source/media safety.
- **106:** full authenticated chat posting/reply/dedupe/moderation/unread/mute and direct-ID RLS paths, safe deep links and remote-session revocation; refactor arbitrary-user `team_channel_access(team,user)` into an internal/service helper to prevent eligibility probing without breaking definer notification fan-out. Existing overload is **not repaired here**. Complete keyboard/screen-reader/weak-network/concurrent-tab matrix remains unverified.
- Prior `teams_metric_boundary.pending.sql` repairs from rows 95/102/103 remain pending as documented previously. No shared SQL is claimed fixed or live.

## Cleanup and revision
- Disposable SQL rolled back; profiles, teams, memberships, requests, sources, copies/receipts, invitation rows and auth stand-ins sum to **0 leftovers**.
- Local cluster and separate UI harness stopped; exact temporary database/files/scripts/screenshots/logs removed. No uploads, shared accounts/sessions, messages, charges, providers, deployment or user-owned edits.
- Platform manages revisions; no manual Git commit. The final observed checkpoint is recorded in the closing response; it may precede the platform's final documentation checkpoint.