# Connected Challenges sprint — 2026-10-31

## Row status

All six rows remain **partially implemented / partially verified**, not complete.

| Row | Changes / evidence | Remaining acceptance |
|---|---|---|
| 72 | Actual builder templates and active-language Back/Next tested; upload/reorder/save races fenced. | Full authenticated save/reopen/preview/upload/lifecycle, field-error focus and physical/accessibility review. |
| 110 | Public free enrollment now remains active without team membership; direct public definitions readable only through eligible/owner/active paths. | Real signup→enroll→Me→participant browser; no standalone coach without-team create path added. |
| 111 | Actual daily/weekly duplicate check-ins and model/target logic tests; period-aware active card timezone. | Full target/completion/points/retake/calendar and photo validation browser matrix. |
| 112 | Existing extras/description/quantity and resource links retained; upload race controls improved. | Real private uploads, referenced gated-resource access, extras delivery/refund/inventory concurrency and orphan cleanup. |
| 113 | Explicit selling gate at server/RPC boundaries; paid publication still fails closed. Owner archive/unpublish/restore/copy/draft-delete and caller leave added without deleting history. | Paid provider journey, reconciliation for public buyers (legacy settlement still requires team/invite), amount/currency/refund/late-payment acceptance. No transaction run. |
| 117 | Public constraint fixed, paid direct lookup gated, capacity metadata uses effective membership; enrolled public users navigate to participant item and invalidate Me. | Full coach-card/public detail/signup/auth switching/cache/RLS browser acceptance, ended cards (coach list still hides ended), public cover imagery and long error flow. |

## Confirmed defects and evidence

1. **Public option could never save:** hosted read-only constraint inspection found both the new `open/invite/public` constraint and legacy `challenges_enrollment_values` allowing only `open/invite`. Local legacy constraint repro rejected public. Migration 0215 widens the conflicting constraint; status now also supports archived. No user rows changed.
2. **Public enrollment disappeared:** original active-membership function required direct team membership even though public eligibility did not. Actual-function local pre-fix assertion failed `public_enrollment_inactive_without_team` (exit 3). Corrected member gate permits public enrollment, retains team/invite rules for nonpublic, and removes access after invite revocation. My challenges, private reads and scoring share this gate. Post-fix opt-in assertions passed.
3. **Suspended public caller could enroll:** eligibility omitted user suspension in its public branch. Added explicit caller suspension rejection; local suspension assertions pass for eligibility and active access.
4. **Paid direct public lookup / checkout bypassed launch visibility:** coach cards already gated paid, but get_public_challenge lacked the selling gate and order function lacked explicit positive-total switch enforcement. Added both plus server pre-provider gate; no flag/provider activated. Public paid CTA remains disabled with honest setup note.
5. **Capacity display counted revoked/ineligible active records:** public full metadata and canonical create-order capacity now use challenge_member_active like free enrollment. Challenge counts permit authoritative eligible public nonmembers; do not expose participant identities/progress.
6. **History deletions:** owner delete and own-membership delete paths could cascade/remove history. New triggers refuse history-bearing/non-draft deletion and require caller leave instead of membership delete. Leave revokes access and retains check-ins/orders; re-enrollment stays fail-closed. Owner draft copy copies configuration only with messages disabled; archive/unpublish closes participant access; restore is draft. These paths were absent controls, not reported as pre-existing tested successes.
7. **Async upload could save too early or target a moved activity:** cover/file upload now participates in busy tracking, cover setter preserves concurrent fields, and reorder/delete during activity upload is blocked. No upload made in this pass.
8. **Client races / post-enrollment stale Me:** check-in/join/public join have synchronous locks; public enrollment invalidates My challenges and routes to the same participant item. Account/item changes reset selections/welcome/sheets/edit state. Period-aware active card uses event timezone rather than browser day. Join/check-in date queries refresh on focus/poll. Root identity cache clear is preserved.
9. **No-team infinite loading:** useChallenges previously returned loading forever with zero ancestors; no-team disabled query now presents the actual empty list instead of infinite loading. It does not invent ownership or create a team.

Rejected audit claims: review validation already aggregates all applicable steps; full coach cards may remain viewable while full. New-builder reset reproduction passed before edits, so it is not claimed as a fixed bug.

## Verification performed

- Focused: 5 files / 36 tests, exit 0. Templates (all four), active-language data, Back/Next target preservation, scoring/weekly periods/prices/extras, locale parity and literal/dynamic translation coverage.
- Full suite: **125 files / 983 tests, exit 0**. Latest automatic typecheck/production build **build OK**, 21:20:20 UTC. Environment runs compilation automatically; no manual build/typecheck invocation.
- Disposable local PostgreSQL: actual source/hosted-equivalent eligibility/enrollment/member/list/check-in/streak functions on **minimal stand-in tables/helpers**, not complete auth/RLS/storage app. Old/new public-member reproduction; free public enroll→Me, duplicate enroll/check-in, weekly dedup, suspended/invite/revoked/draft/paid/anonymous guards. Exact local fixtures rollback; counts zero challenges/members/check-ins/orders. Legacy constraint reproduced separately. No shared fixture records/accounts/files.
- Browser isolated Vite app: actual ChallengeBuilder/ResponsiveSheet/styles/translations, test-only server/auth/database/cover stubs. EN/ES at 320/390/1280, every template, Back/Next preservation through Review, no page errors/overflow. Spanish 320 screenshot reviewed. Publish button visible but **never clicked**; no saved app data, no paid call, no camera/location/provider messages. This does not establish real auth or persisted lifecycle.
- Launch switches read-only verified selling/referrals/courses/assessment remain off. Migrations 0214–0216 applied schema/functions only.

## Honest blockers and remaining gaps

No separately provisioned **full disposable application/backend** exists here. Real coach→public visitor→signup→free participant journey, complete RLS/direct-ID, unrelated owner/account tab/cache refresh/relogin/back/forward, roster/progress refresh, all long errors/loading/retry/keyboard/screen-reader/dark/theme checks remain unverified. Need separate auth/schema/storage/app clone with disabled providers/jobs, never shared preview fixtures.

Owner-only management is preserved: no challenge cohost/delegated manager model was invented. Public paid reconciliation still contains historical team/invite checks; selling remains off and paid publication blocked, so this is recorded rather than changed without provider acceptance. Points remain one point per valid check-in, not arbitrary custom scoring. Target remains count of allowed check-ins, not externally verified product activity. Resource destination routes/RLS retain their own gates; attached resource access is not automatically granted and full verification is missing.

No automatic reminders sent/enabled. No legal wording, fee/payment architecture, provider activation, real charges/refunds/transactions, real publication/deployment or user-owned edits. Cleanup is exact local rollback and temporary environment removal, recorded in final run. Implementation revision prior to final evidence updates: 5e4d61eccdfe1254eddc2bf7f02d6363482d6c72.