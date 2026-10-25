# Roadmap

## Website Notes priority group (2026-10-25)
- [x] P1 onboarding 18+ blocker: finish() now refetches the profile before caching onboarded, so the app gate never sees a stale pre-confirmation row; confirm_adult was already idempotent. Browser-verified fresh-account path on the ZZ-TEST fixture (reset → gate → confirm → /start → refresh/sign-out-in stay unlocked), fixture restored exactly. Real email-link signup not possible in sandbox (magic-link only).
- [x] P2 mobile nav: fixed five-slot bar (4 primary + More) replaces horizontal scroll; Communication/Insights/Me inside More with active state; verified EN/ES at 320/375/390px, no overflow, fixed while scrolling; desktop sidebar unchanged.
- [x] P3 profile menu mode switch: shared useSwitchMode hook used by Me and the account menu; verified switch to attending (guest nav, menu closes) and back to hosting; profile restored to host/hosting/onboarded.
- [x] P4 admin owner-guide removed from console + locales + styles; all 15 admin tabs intact.
- [x] 486 tests, harness typecheck/build OK, zero console errors. Unverified: screen-reader narration, real-device safe-area, non-admin second-account browser pass.

## Insights primary navigation
- [x] Reuse /insights in the shared desktop/mobile shell with scoped visibility, bilingual fallback and nested active state.
- [x] 478 tests; automatic typecheck/build OK; EN/ES 390/1280 keyboard menu return, selected state, signed-out login redirect and zero console errors. Second-account browser isolation and screen-reader narration unverified; no data/guard changes.

## Reopened image creator and persistent admin navigation
- [x] Unified Square/Story/Wide previews, downloads, native file shares and event-detail Story export; focal cropping, blended fades, bounded text and canonical footer.
- [x] Global authorized Admin dashboard menu with verified /admin → Events → /admin return on EN/ES desktop/mobile.
- [x] Layout and admin-menu tests; 474-test suite, automatic build/typecheck and actual 1080×1080, 1080×1920, 1200×675 export verification.

## Newly added Website Notes — translation repair
- [x] Home network EN/ES strings, localized fallback safety and real /network CTA.
- [x] Resource create string leaf, existing chooser → type-specific editor actions and unchanged authorization.
- [x] 466 regression/full tests; automatic typecheck/build OK; EN/ES 390/1280 Home/Resources click-through, signed-out redirects and zero browser console errors.

## Website Notes beta-quality pass (2026-10-25)
- [x] Current compile reports resolved without rollback; full automated verification rerun.
- [x] Home copy, real-record card links, member/invite destinations and permission-scoped UTC monthly attendance history.
- [x] Existing protected /admin, admin-only Me link and bilingual Owner Guide.
- [x] Owner login/account: Nick confirms nickc35@gmail.com has a verified admin role and login works; preserve the existing role.
- [x] Insights event-date cohort comparison, definitions, event/resource drilldowns and draft/waitlist attention signals.
- [x] Capability-aware top-level Communication and existing automation event/audience selector; existing event journeys preserved.
- [x] Resource enrollment journeys: entitlement-bound wait/send/condition execution, scoped runs and pause/resume; in-app activation only.
- [x] Provider-independent verified-account coach preferences/unsubscribe/aggregate segments; anonymous requests honestly pending without confirmation sender.
- [x] Admin visibility/role tests, isolated resource enrollment delivery + two-coach/token/RLS checks, mobile/desktop layouts; 461 tests and latest harness build OK.
- [x] Separate /challenges launch reuses the real editor; Standard/Retreat selector retains existing feature gate and persistence.
- [x] Multi-event experience: bounded validated sessions, whole-event admission and schedule; private draft save/readback verified and fixture removed.
- [x] Full automated suite (439), harness typecheck/production build, EN/ES 390/1280px screens, keyboard card navigation and previous 640px zoom reflow.
- [ ] Blocked verification: campaign/confirmation email (no sender), shared-preview enrollment browser readback and signed-in non-admin browser denial (second authorized account), mobile keyboard containment/screen-reader narration; earlier nonempty attendance and retreat QA remain unverified.

## v0.33 custom coach public links
- Done: /h/$slug pressure-test, custom slug editor with server-side validation/reserved words/uniqueness/rate limit, old-slug alias redirects, EN/ES, browser QA 16/16.
- Open: screen-reader pass on the slug editor; second-account browser pass.


## v0.32 type-first resource authoring

- [x] /learn/create chooser: 10 type cards with icons/examples/"Best for", help panel, back/choose-another, creator-only.
- [x] Type presets into existing editors (track+lesson flows, recipe, course, file/bundle offers, quiz parent picker); audio lessons; draft-only creation.
- [x] 349 tests, typecheck/build OK; browser 38/38 at 390/1280 EN/ES + 200% zoom + reduced motion; fixtures removed.
- [ ] Manual: screen-reader pass on chooser; second creator account browser pass.

## v0.31 Resources redesign

- [x] Events-style /learn with tabs, filters, ResourceCard, Create resource chooser.
- [x] Resource templates (/learn/templates) with starters, team save/reuse, drafts only.
- [x] Text/audio/file lesson fix; tests, security checks, browser QA, docs.
- [ ] Manual: second member account browser pass, screen reader, 200% zoom on new pages.

## v0.30.2 pricing simplification

- [x] Removed comparison chart, unused desktop/mobile legacy variants, chart-only translations/styles/tests; retained cards, billing toggle, guidance, terms, FAQs and support intent.
- [x] 71 focused tests; full suite 320/320 (41 files); 96/96 browser checks at 390px/1280px EN/ES; harness typecheck/build OK. No chart gap, pricing unchanged, no fixtures or data changes.

## Completed: v0.30 approved per-plan pricing

- [x] Per-plan fee ladder (Free 5%, Advanced 3%, Pro 2%, Team 25 1%, Organization 0.5%) in DB fee rules (migration 0088, plan-aware resolver), app constants, UI, EN/ES copy, tests.
- [x] Builder-seat model (owner/admin/host/content_editor count; check-in/analyst/moderator/member do not): Free/Advanced 3, Pro 5, Team 25 25, Organization up to 100; server-side enforcement in invite/accept/role change.
- [x] Pricing page: monthly/annual toggle, Organization Contact sales, builder-seat explainer, "Which plan is right for me?".
- [x] Plan/upgrade surfaces aligned; founding-host offer preserved and non-stacking.
- [x] QA: 321 tests/41 files, tsgo clean, build OK; browser 8/8 (390/1280px, EN/ES) — toggle, Contact sales, no overflow, 44px targets, no console errors.

## Completed: v0.29 homepage simplification

- [x] Short hero pitch + swipeable/keyboard carousel of approved category imagery; no event records on the homepage (test/template rows cannot surface).
- [x] Long feature catalog replaced by three host cards, one attendee band, pricing teaser link and single trust line; details remain on dedicated pages.
- [x] Browser QA 99/99 (390px/1280px, EN/ES, 200% zoom, reduced motion); 304 tests, typecheck and build pass.

## Completed: v0.26 QA pass (communications + tickets/check-in)

- [x] Signed-in browser QA at 390px and 1280px: bell, notifications, updates, discussion, contact host, support, Setup-required gates.
- [x] Ticket QR/fallback/calendar and check-in manual/invalid/repeat/undo flows.
- [x] Accessibility: keyboard focus and restoration, 200% zoom, reduced motion, 44px targets, no overflow, EN/ES parity.
- [x] Defects fixed with regression tests; full suite, typecheck and production build pass.
- [x] Temporary ee000010/Fx10 fixtures fully removed (public rows and the fixture auth account), verified at zero; real owner adult confirmation preserved.

## Remaining manual/device checks

- [ ] Screen-reader narration pass on ticket/calendar, communications and check-in surfaces.
- [ ] Real-device camera permission and live QR scan pass.
- [ ] Wallet provider certificates (UI remains gated as Setup required).

## Completed: v0.27 insights, admin support, privacy & data

- [x] Host /insights dashboard with real event/offering/sales aggregates and aggregate-only CSV exports.
- [x] Team analytics gated to owner/admin/analyst via team_capability.
- [x] Admin support-ticket triage tab with audited staff replies and close.
- [x] Me > Privacy & data: Download my data (JSON, own rows only) and consent history.
- [x] 287 tests, typecheck, build; browser QA 17/17 (phone/desktop, EN/ES); no fixtures created.

## Remaining

- [x] v0.28 focused closure: 303 tests/41 files, final-source harness build OK; 37 admin/anon + 60 other-role live assertions, grant checks, rollback SQL checks, saturation 66 requests/12 safe rejections, Support 20/20, account lifecycle 22/22; six auth users removed, 140-table scan zero.

- [x] Clarified parallel-site workflow: remix latest, revert original; pre-remix Cloud versions cannot be restored in the remix; code revert does not roll back data.
- [x] v0.28: platform safety queues, private lookup, reversible interventions, scoped suspensions and audit.
- [x] v0.28: 294 tests; 28 admin page checks, 8 keyboard checks, 17 denial/UI checks, 15 live action checks; all temporary fixtures removed, 140-table scan zero, release documentation updated.

- [x] Admin support tab empty/list layout verified using isolated removable QA admin, EN/ES, phone/desktop.
- [x] Nonempty admin Support staff-reply/close browser check, four tickets, audit counts verified.
- [x] Fixture account managed-auth ban/reactivation lifecycle; failure compensation unit tests; throttle saturation checked. Cross-service atomicity is explicitly not claimed.
- [x] Equivalent live role/RLS/grant and transaction rollback verification substituted for unavailable disposable database; original disposable script not claimed executed.
- [ ] Screen-reader pass on the new insights/privacy panels.
- [x] v0.33 Event covers & cancellation policies (gradients, overlay/focal/alt, policy picker) — done 2026-10-24
