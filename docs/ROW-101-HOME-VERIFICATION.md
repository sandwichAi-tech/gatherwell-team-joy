# Row 101 — Home isolation (2026-10-31)

## Status: partially verified, not complete

No shared fixture writes, user-owned edits, deployment, real publication, provider activation, messages or transactions. Selling, referrals, courses and assessment flags remain off (read-only hosted check).

## Pre-fix evidence and repairs

- **Future track returned on Home:** original personal_home on disposable stand-in tables returned `ZZ-TEST future access` with a valid track grant and future available_from. can_read_track can bypass publication availability for editors; Home needs its own availability predicate. Migration 0212 adds it. Retest returned `[]`.
- **Hidden saved recipe returned:** published recipe with on_team=false/on_coach=false, saved by a direct team reader, appeared on personal Home. The original predicate checked team access but not destination visibility. Added enabled-destination/course-inclusion check. The same isolated retest returned `[]`.
- **Managed resources omitted:** hosting offer/track branches checked ownership only even when existing authoritative manager helpers allow editing. Reused can_manage_offering/can_edit_track in those branches. Manager positive path is source-verified, not full-role tested.
- **Mode invalidation retained old data:** actual QueryClient seeded with private hosting data still returned that payload after invalidateQueries. Mode switches now cancel/remove Home, brief, QR, follow-up and profile queries. Start hosting also clears brief. Identity transitions clear synchronously, not after cancellation settles. Late response regression confirms cancelled A fetch cannot repopulate A after B starts.
- **Cross-tab mode lag:** invalidate-only local mode updates did not notify other tabs. In-memory BroadcastChannel now sends only a user ID invalidation signal (not permissions or private data); matching tabs clear/refetch. Existing periodic polling remains fallback.
- **Response/key identity race:** user-keyed queries previously accepted whichever authenticated response arrived. Home and brief server responses now include authenticated caller_id; client rejects mismatch/aborted requests before caching. Test confirms a B response cannot populate A's Home key.
- **Managed event relabeled owned in brief:** brief mapped every managed Home event to host_id=caller, generating own-event prompts for assigned events. It now reads caller-owned IDs among already scoped events before generating ownership-only summaries.
- Brief refresh now matches Home's 15-second/focus/mount refresh instead of retaining a 30-second-fresh/60-second interval payload.

## Verification actually performed

- Local PostgreSQL: original Home/helper migrations on **stand-in app tables and access helpers**, not a full cloned application. Five principals (two coaches, two customers, empty account); ownership/draft counts, RSVP/cancel, active/future/expired/revoked grants, paused/refunded/cancelled purchase, unrelated customer and signed-out denial. Explicit opt-in test `tests/database/row101_home_disposable.sql` exited 0 and rolled back.
- Reproduced hidden recipe/future track before migration and empty result after. Real hosted definition inspected read-only; schema change applied by migration tool. No fixture was inserted in shared backend.
- Browser: temporary isolated React/Vite harness imports actual cache helpers and PersonalHomeResources; mocked identity/content, not real app login. EN/ES at 320/390/1280: mode change, A→B, logout, two concurrent tabs receiving mode invalidation, no horizontal overflow/page errors; Spanish 320 screenshot reviewed. Harness English control labels are test-only, not shipped app copy.
- Focused initial suite: 25 tests passed. Full suite before final brief identity addition: 122 files/975 tests, exit 0; final rerun recorded in CHANGELOG. Latest automatic typecheck/production-build signals clean; no manual build/typecheck run because environment runs them automatically.
- Cleanup readback: profiles/events/RSVPs/offers/entitlements all zero after rollback. One explicitly created local stand-in team was removed by destroying the local database. No shared users/files/fixtures created. Temporary browser/database processes, storage contexts and directories removed at close.

## Remaining acceptance and engineering gaps

A **real authenticated disposable application stack** is not provisioned here. A PostgreSQL stand-in and browser harness do not prove hosted auth/RLS/entitlements or app routing. Full acceptance needs an independently isolated backend clone with real auth, current complete schema/policies, private storage, disabled providers/jobs, and a separate app exclusively connected there. Never use shared preview/customer records for fixtures.

Not verified: real refresh/relogin/logout/login/back/forward and auth cross-tab behavior; all manager/cohost, direct-team/follow/subscription and course-inclusion grants; full direct-ID/RLS/private-content isolation; paid-event payment/refund relationships, challenge enrollment Home (not implemented as a dedicated Home section), saves/follows after revocation, paused subscriptions with separate still-valid grants, published/private/draft course/resource combinations, summary/count permissions after revocation, loader/error/retry/weak-network screens, all Home cards' launch visibility, full keyboard/screen-reader/theme/physical-device review. Current Home still lacks some eligible track-save/direct-team/course-included/challenge listing paths; these are not marked complete. This pass fixes confirmed leaks/cache boundaries without widening unrelated catalog access or changing global billing grace/cancellation rights.