# Row 120 — Wellness Builder verification (2026-10-31)

## Status: partially verified, not tracker-complete

No deployment, provider activation, messages, transactions, shared fixtures, user-owned edits or launch-switch changes. Migration 0211 changes only the existing participant function's SQL alias.

## Reproduce-before-fix evidence

- Two-question ZZ-TEST React fixture and browser harness: question 2's Single choice score switch was flipped six times. Labels remained intact and question 1 remained independent. The toggle alone was **not reproduced as defective**.
- Changing question 2 to optional text then back to Single choice cleared both labels. Pre-fix regression failed; browser read back an empty first label. Fixed by retaining hidden choice IDs/labels/values and resolving edits against current question state.
- Read-only hosted scope query returned zero available documents. Original publication function, run locally on isolated stand-in tables, returned `ERROR: approved_assessment_content_required`, SQL invocation exit 3. Builder showed missing scope, unsaved state and question issues. No scope control bypassed.
- After temporarily inserting a local-only ZZ-TEST scope, participant completion failed with `column reference "q" is ambiguous` in answer-key validation. Confirmed the same alias in the hosted function by read-only inspection. Migration 0211 qualifies `question_entry.value`; isolated submission then succeeded.

## Fixes and evidence

| Defect | Change | Verification |
|---|---|---|
| Text/back erases labels | Preserve hidden options and scores; text always unscored | Builder regression + EN/ES browser |
| Partial destination failure looks saved | Clean fingerprint only after destination/binding success; retain revision for retry | Failed-destination/retry regression |
| Destination/price-only edits not dirty | Fingerprint covers content, placement and price | Concrete fingerprint regression |
| Optional preview text disappears between tabs | Controlled author-only text state | Tab round-trip regression, no completion call |
| Preview retains incompatible selection after type change | Clear question's preview selection on type change | Current code; full round-trip multi-to-single selection not separately verified |
| Generic publication errors hide scope/history action | Specific errors; explicit admin document registration requirements | Error mapping tests + visible EN/ES missing-scope panel |
| Published assessment looks editable/draft | Published state, read-only fields and save/publish guards | Source audit; published-state browser not verified |
| Bounds differ from publication validation | 0.1–100 weights, 2–8 labeled options, finite values, unique IDs and valid populated ranges | Existing/new focused tests; exhaustive malformed-config matrix not verified |
| Rapid participant submit has state-only lock | Synchronous ref guard; stable retry request; read receipt before optional course-credit retry | Participant retry regression; simultaneous network requests not verified |
| Direct quiz/course assessment view lacks parked gate | Reuse assessment FeatureRoute on both entry paths | Source audit + existing launch-rule tests; authenticated gate navigation not verified |
| Participant completion SQL ambiguity | Migration 0211 | Original failure, isolated success, read-only hosted definition check |

## Checks actually run

- Full suite: **120 files / 970 tests passed, exit 0**. Initial full run detected missing published-label keys; corrected both languages and reran successfully.
- Focused initial rules: 29 tests passed; final builder/player regression files: 6 tests passed. Full suite includes these.
- Harness automatic typecheck/production-build entries: newest entries `build OK`; manual builds/typechecks were not run because this environment runs them automatically.
- Browser: actual imported builder/player components in a temporary Vite harness. Mocked auth/read/write adapters; never connected to hosted services. EN and Latin American Spanish, 320/390/1280 widths. Exercised label editing, six score toggles, all four type transitions, weight, add/remove option, reorder, Save draft, refresh/reopen, preview single-choice replacement, disabled no-scope publish and participant-component single replacement. Zero measured horizontal overflow or page errors. Spanish 320 screenshot reviewed. Fixture host text stays untransformed.
- Database: original migration functions/collection trigger on throwaway local PostgreSQL, with **stand-in app tables/access helper**, not a full app clone. Missing-scope rejection, test-scope publication, missing-consent rejection, multiple single-choice rejection, scored/unscored result 100, same-request idempotency, changed-request rejection, retake-off rejection and author-completion rejection. Exit 0; all fixture writes rolled back.
- Hosted read-only follow-up: zero approved scopes; fixed alias present. Production remains blocked by its real approval requirement. No test approval was inserted there.

## Cleanup

Local rollback readback: quizzes **0**, scopes **0**, receipts **0**. No shared accounts, files, events or assessment fixtures created. Temporary browser storage existed only in fresh localhost:8081 contexts; contexts closed. Local database/server and temporary harness/files removed at close. Kept only regression source and this report in the project.

## Honest remaining acceptance gaps

This was **not an authenticated end-to-end live app verification**. A full disposable application stack with actual auth, current schema/RLS/entitlements, private storage and the app pointed exclusively there is needed. Do not run test fixture journeys against shared preview/production.

Unverified: real relogin/session switching, full host/participant/other-host/signed-out RLS matrix, actual receipt immutability/history/retakes-on/rate limit, course-credit and destinations with real entitlements, free/paid access (paid selling stays off), cover upload, all Basics language/title/description save combinations, question/result delete confirmations, every result-range error, Review/Fix focus, complete keyboard/screen-reader flow, long raw-key/overflow states beyond the reviewed panel, published edit/unpublish/archive/restore, concurrent submissions/weak network and physical devices. No cover authoring or admin scope approval screen added in this pass. Admin must supply and register genuinely approved EN/ES scope versions; no legal or medical document was invented.