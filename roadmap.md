# Challenge experience pass — DONE

## Website Notes rows 107–109 — In Progress
- [ ] Audit and reproduce walk-in, local-day Home check-in and next-action state.
- [ ] Implement event-bound duplicate-safe walk-ins with capacity/payment/waiver guards.
- [ ] Restrict Home shortcuts to event-local today and use saved caller-scoped recommendation state.
- [ ] Focused/full tests, isolated live owner/staff/outsider checks, EN/ES layouts/accessibility review.
- [ ] Exact fixture/session/screenshot cleanup; record evidence and remaining gaps; no publication/deployment.

## Website Notes row 101 — In Progress
- [x] Audit Home modes, team/catalog leakage, RSVP/purchase/entitlement/follow access and cache lifecycle.
- [x] Replace broad Home reads with authoritative caller-scoped payload; preserve Discover and rows102–106.
- [x] 31 isolated authoritative checks; 18 EN/ES mobile/desktop layout checks; 10 focused and 770 full tests; supported automatic compilation OK.
- [x] Exact isolated account/content cleanup verified; no messages/charges/publication/deployment.
- [ ] In Progress: full browser relogin/mode switching, manager/course/all-type/subscription/refund access matrix, open-sheet revocation/weak-network/retry and screen-reader/physical-device review unverified. Payment/refund provider test environment not exercised.

## Website Notes rows 102–105 — In Progress
- [x] Audited ownership, legacy active memberships, immediate invitations, named roster, template/network copy models and row106 guards.
- [x] Added owner approval, My teams sections, named owner-only requests/roster, persistent status and direct channel integration.
- [x] Explicit blueprint/resource-template sharing, existing recipe/track/course/download draft copying, event configuration-only draft exports and copy retry receipts.
- [x] Five isolated accounts/two teams: approval/retries/decline/removal, invite pending, code rotation, private denial, independent copies; EN/ES roster 320/390/1280; 39 focused/767 full tests; automatic compile OK.
- [x] Exact new accounts/teams/memberships/requests, sources/copies/events/resources/notifications removed; zero queried leftovers. Temporary scripts/screenshots/sessions removed.
- [ ] Rows102–104: complete relogin/mode-switch/notification-click, suspended/expired-link/removed-open browser and full accessibility matrix unverified.
- [ ] Row105: safe full media rehoming, quizzes/audio completeness, event agenda/waiver configuration, full authored-source copy/customization/publish matrix and paid-entitlement isolation checks incomplete. Do not mark Completed.

## Website Notes row 106 — In Progress
- [x] Audited existing communication, direct memberships/invitations, owner/leader, notification, search and moderation paths.
- [x] Reused announcements/chat with strict direct-team access, owner-only management, separate unread/mute, safe links/deep links and retry dedupe.
- [x] Five-account/two-team permission, unread/mute/opt-out/reply/suspension checks; browser create/post/removal; EN/ES announcements 320/390/1280; 13 focused and full 758 tests; automatic compilation OK.
- [x] Exact fixtures/accounts, dependent badges/read-state/activity/notifications and temporary scripts/screenshots/sessions removed; zero core leftovers verified.
- [ ] Complete multi-surface/multi-team browser, notification-click/relogin, reconnect/delivery races, offline retries, physical keyboard/screen-reader/device checks; external delivery intentionally untested.

## Resource placement and monetization pass — In Progress
- [x] Audited ten creator types, placement, public coach/My coaches, access and existing commerce.
- [x] Added shared exclusive placement/Free-Paid controls, existing-offer bindings, course access guards and bilingual Quiz results wording.
- [x] Verified isolated host/outsider track types plus recipe/quiz/download access; paid draft/reopen/free publication; EN/ES 320/390/1280; full 87 files/751 tests passed, automatic compile OK.
- [x] Exact fixture cleanup verified; no messages/charges/publication/deployment.
- [ ] Paid checkout/order/receipt/refund/idempotency end-to-end remains blocked: resource runtime checkout key absent and existing offer order/refund linkage not verified. Checkout intentionally disabled.
- [ ] Complete all-type browser/course reassignment/library-price/archive matrix, keyboard/screen-reader and physical devices; these remain unverified, not Completed.

## Optional event add-on images
- [x] Reuse private media/crop controls; optional images verified through draft/refresh and publish/reopen.
- [x] Event-bound signing, uploader/reference-aware cleanup, non-destructive replacement/remove, attendee preview and EN/ES 320/390/1280 checked.
- [x] 52 focused tests; full 86 files/736 tests; automatic compilation OK; isolated host/outsider and media cleanup; no deployment.
- [ ] Remaining verification: real devices/screen reader, credential outage and co-editor/cross-team transport matrix; physical devices unavailable. Existing commerce has no add-on purchasing/order associations.

## Waiver library — rows 64, 84–86
- [ ] 85 In Progress: private text library, immutable versions, preview/archive and manager isolation implemented; library create/edit browser submit matrix still unverified.
- [ ] 64/86 In Progress: explicit attachment, free registration/history/check-in verified; paid checkout acceptance and complete waiver failure UI matrix remain unverified (no safely configured payment test environment).
- [x] 84: traced missing requires_waiver selection; exposed explicit team requirement, pinned text version, public visibility verified.
- [x] Isolated three-account permission/registration/history checks and exact cleanup; EN/ES library 320/390/1280, no overflow/runtime errors; 22 focused + full 84 files/721 tests; automatic compilation OK; no deployment.

## Attendance launch pass — rows 93, 98, 99, 100
- [ ] 98 In Progress: event-bound owner/staff/outsider, two attendees, waiver/cancellation/wrong-event/duplicate and camera-denied manual checks passed; physical camera and full offline/retry UI matrix unverified.
- [ ] 93 In Progress: Home QR decoded privately with jsQR and accepted through event-bound scanner manual fallback; wrong-event and duplicate verified; physical phones remain unavailable.
- [ ] 99 In Progress: editable draft and next-day schedule saved through UI; attended/absent/opt-out/cancelled/correction eligibility and in-app deduplication verified; full schedule-edit/claim-time preference race matrix unverified.
- [ ] 100 In Progress: fresh coach onboarding/free publication/public RSVP/QR/check-in/follow-up pilot passed; paid provider test environment, real delivery, complete fresh attendee/role-switch/team-invite approval/free-resource browser pilot unverified.
- [x] EN/ES Home and follow-up editor at 320/390/1280; keyboard focus repair; 83 files / 718 tests passed; automatic typecheck/compile build OK; exact fixture cleanup verified; nothing published.

- [x] P1: step-based challenge builder (basics/model/activities/messages/review), goal/streak/points models, draft/publish lifecycle, participant Today + goal progress + conditional leaderboard
- [x] P2: challenge messages (6 kinds) in builder + Communications hub section with pause/edit and honest channel labels
- [x] P3: activities attach resources/links/files with day availability; participant view renders them
- [x] Migration 0111 applied; 510 tests, typecheck, build OK; EN/ES 320/375/390/1280 verified; fixtures cleaned

## Referral program (rows 56–58) — built 2026-10-25
- [x] Opt-in per paid item, % or flat, 30-day last click; block self + any shared-team pair; team-only events ineligible
- [x] Commissions visible only to owning host (program area) and each referrer's own earnings; update PROJECT_RULES + CHANGELOG exception
- [x] Totals stay zero until payments connected; lifecycle tested only with removable fixtures
- [ ] Browser-test program setup sheet + link copy/share with a real eligible paid item (blocked: no paid items until payouts connect)

## Profile/team usability (rows 66–69) — built 2026-10-26
- [x] Invite landing, multi-category chips, profile editor split, team edit/description
- [x] Unauthorized member view, public coach categories and Discover coach filter verified with removed fixtures
- [x] Row 63 site-wide image quality (events, Discover, resources, recipes, team; real devices unverified)

- [x] Row 60 PDF resources
- [x] Row 61 Resource blueprint publishing (track blueprints; live-workshop date/link edited in Manage)
- [x] Row 62 Full Resources pressure test (course release schedule enforced 0130; paid restore and real checkout wait on payouts)
- [x] Row 70 Team discussion links + conversation replies/mentions (fixtures removed 2026-10-26)
- [x] Row 71 Quiz studio: scored/outcome/poll, images+alt, player/results/retake, coach summary, Resources (paid-course quiz purchase path blocked until payouts connect)
- [x] Row 75: saved photo public refresh/card; type/size/decode/network/replacement failures; previous image retained.
- [x] Row 76: unlimited registration, limited exact-full and over-capacity waitlist; disabled waitlist full state checked. Explicit unlimited never inherits a plan capacity.
- [x] Row 77: address/override directions, unsafe fallback tests, online directions hidden; duplicate unsafe raw map link removed.
- [ ] Row 78: free tier windows and save/reopen checked; public tiers restored. Paid-tier checkout/inventory remains blocked pending implementation/provider verification.
- [ ] Row 79: linked summaries, keyboard focus/correction and conditional fixes checked; complete retreat/session/policy/recurrence conditional coverage remains unverified.
- [ ] Row 80: minimum free person/online/hybrid and co-editor server publish checked; full co-editor browser and provider-connected paid publication remain unverified.
- [ ] Row 81: quick/full untitled drafts, photo/tier/text restore and publish checked; multi/retreat/recurrence and fresh-login full field matrix remain unverified.
