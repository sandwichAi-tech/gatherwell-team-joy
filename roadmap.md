# Roadmap

Active work follows the approved Prompt 1–17 sequence in the ZoheeWell Beta Product Blueprint and Lovable Build Plan v4 (see SOURCE_OF_TRUTH.md).

- [x] Prompt 0 — Read-only audit of commit fe1db59
- [x] Prompt 1 — Install source of truth and remove rule conflicts (documentation only)
- [ ] Prompts 2–17 — per Blueprint v4, each requires its own approval
- [x] Prompt 2 correction — applied 0049/0050, consent 7/7 verified, evidence recorded, 96 existing tests pass, counts/flags unchanged
- [ ] Disposable-copy SQL role regression — requires an isolated writable database copy; never run on production
- [x] Homepage density fix — removed immediate duplicate Host/Attend section; compact four-step and 15-tool layouts verified at 390px/1440px, both CTAs work, 96 tests pass; verification limits in CHANGELOG.md.



---

# Historical record — pre Blueprint v4 rules (not active)

> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# Walkthrough 2.1 — Host-first homepage (October 23)
- [x] Kept current look and headline; Host / Attend paths, four hosting steps, all tools and coming-soon premium outreach added. Phone 390px / desktop 1440px links/layout checked; 17 routing tests passed and CHANGELOG.md updated.
- [ ] Future Retell AI outbound calling and Twilio text verification/notifications — awaiting a separate setup scope and service connections; no sends in this homepage-only step.

# Walkthrough 1.6 — Personal morning brief (October 23)
- [x] Reuse Home’s brief with real user-scoped hosting, attending, leader-team and new-resource lines; hide empty lines and provide Create an event fallback.
- [x] 24 checks passed; Scott/Nick signed-in briefs differed and real team counts matched Cloud. Team links opened populated Insights; phone/desktop text fit. CHANGELOG.md records definitions and unpopulated hosting/attending/resource browser limits.

# Walkthrough 1.4 — Resources (October 23)
- [x] Enable existing Learn for everyone, rename navigation/page labels to Resources, keep internal routes, and hide empty/broken entries; documented in CHANGELOG.md, 21 targeted checks passed.
- [ ] Verify normal-account main navigation on phone/desktop and recipe interactions — waits on a non-admin preview sign-in; explicit-account sign-in permission declined. No existing tracks/lessons to exercise.

# Walkthrough 1.3 — Event Blueprints (October 23)
- [x] Reuse the existing blueprint library/editor; added Team and Events entry points, full defaults, host save-as, edit/delete and reliable creation prefill.
- [x] Real create → use → draft event and event → save as blueprint passed at phone and desktop sizes; edit/delete/usage/navigation verified, 10 checks passed, CHANGELOG.md updated. Test records removed. Separate non-leader host, physical-device photo upload and paid checkout not exercised.

# Walkthrough 1.1 — Dead-click audit (October 23)
- [x] Audit public and signed-in screens at phone and desktop sizes; saved DEAD_CLICKS.md: 27 actionable findings, seven unfinished/service-dependent groups, source coverage of all 59 content-route patterns, 120 page inspections and 48 menu/sheet/tab observations. Report only: no app code changed; transaction/role/private-token limits and existing calendar read provisioning documented.

# Team feedback — October 21
- [x] Add password-based admin sign-in; existing administrator password set securely, wrong password rejected, real Admin > Mail loaded and session retained after reload; temporary setup secret removed
- [x] Compact leader insights card on Home; Insights shortcut at top of Team
- [x] Say "event" instead of "gathering" everywhere (English + Spanish)
- [x] Rename team templates to Event blueprints with a clear explainer
- [x] Challenge form: one title/description in the creator's language (copied to the other)
- [x] Hosts and leaders can edit their own liability waiver from Team
- [ ] Section 7: reorganize Resources (guides, downloads, replays; recipes as a tag) and move customer challenges there — navigation restored in Section 1.4; content reorganization deferred
- [x] Show blueprints inside the New event form

# AD2 — Admin message retry
- [x] Add confirmed, audited retries for failed messages without bypassing recipient preferences
- [x] Verify retry eligibility, simulated processing and opt-out handling with 10 targeted tests; 16 routing tests passed and build OK
- [ ] Verify a real retry and audit read-back in Admin > Mail; blocked because no preview account matches the requesting user and no admin session is available

# Mobile layout audit — October 10, 2026
- [x] Simplify guest RSVP, keep confirmation reachable, and verify reminder defaults without preselecting guest consent; test RSVP saved/read back/cancelled, 375/414px Spanish checked, three consent tests passed. Existing query-feedback warnings and a background 400 remain outside this change.
- [x] Check principal public pages at 375/390/414px in English and Spanish, including menus and gathering previews; other public error/legal states checked at 375px
- [x] Inspect signed-in layout source and shared overlays; distinguish confirmed defects from source-only risks (authenticated visual verification remains blocked)
- [x] Deliver detailed mobile findings, evidence, coverage, and remaining verification blockers in MOBILE_AUDIT.md and the downloadable audit PDF

# D1 — Premium design audit (current priority)
## Landing polish — October 7
- [x] Strengthen marketing category and vignette icons with matching duotone treatment
- [x] Refine mobile weekly heading, spacing and below-card action
- [x] Verify 390px and 1440px in English and Spanish

- [x] Inventory every screen, popup, menu, toast and empty state against the ten design criteria
- [x] Save source-backed findings and browser evidence to DESIGN_AUDIT.md before visual fixes
- Step 1 delivered: 40 route entries, 72 named overlays, individual toast call sites, menus and state register; source-only and unverified states explicitly distinguished. No visual fixes made.

# D1 Step 2 — Design System 2.0 (report after each phase)
- [x] Phase 1 Foundation
- [x] Phase 2 Shared overlays (ConfirmDialog, toasts, menus, mobile menu)
- [x] Phase 3 Me and member profile
- [x] Phase 4 States
- [x] Phase 5 Screen drift
- [x] Phase 6 Verification + audit rescoring

# Design System 2.0 continuation — October 7
- [x] Phase 2: finish shared overlay gaps, localized admin options and keyboard checks
- [x] Phase 3: extend profile treatment to host/team pages and Me sheets
- [x] Phase 4: verify new page loading, empty and unavailable states
- [x] Phase 5: remove drift in follow and calendar layouts
- [x] Phase 6: bilingual/theme/viewport checks and updated audit evidence

# Gatherwell design reset
- [x] Save permanent replacement design rules
- [x] Replace shell, theme, typography and app icons
- [x] Rebuild Home and four tabs with bilingual sample content
- [x] Verify desktop/mobile navigation, sheets, language and theme

# Launch checklist
- [x] Custom report limit: five per rolling minute per person or guest IP
- [x] Main-screen review at 375, 414 and 1440 pixels; contrast and safe-area refinements (not every populated detail state)
- [x] Spanish/English resource parity and locale-formatting checks (not a complete editorial audit)
- [ ] Production first meaningful screen under two seconds on 4G; development measurement failed this target
- [x] Shared loading/retry states, image-delivery reuse and public cache headers
- [x] Open-page weak-connection check-in/QR, retry states and premium 404; fixture-tested
- [x] Main-screen automated accessibility checks in both themes and keyboard dialog check
- [x] Public-page share fallback and leaf metadata (live gathering shares still need production verification)
- [x] RSVP SMS terms, Me/footer legal links and analytics no-op checks
- [x] Deliver an itemized change list and honest remaining blockers; skip two-account journey

# Prompt 21A (one area at a time)
- [x] 1. Network: connections, sharing, featuring, guest referral thank-yous
- [x] 2. Host offers: memberships, courses, downloads, Me > Purchases
- [x] 3. Guest referral rewards (Welcome points)
- [x] 4. Playbook engine

# Prompt 21B (after 21A; one area at a time)
- [x] 1. Liability waivers
- [x] 2. Co-hosts
- [x] 3. Custom RSVP questions, approval, invite-only
- [x] 4. Conversation: comments, team discussions, WhatsApp link, reply notifications
- [x] 5. Follow pages (/h, /t) and private calendar feeds

# N1 — Bug fixes and onboarding polish
- [x] Go to Home reliably marks onboarding complete and navigates
- [x] Copy buttons reset after 2 seconds and work every time
- [x] Playbook "gathering gatherings" wording (EN/ES)
- [x] Crop step for avatars and team/gathering/template/challenge/track covers; gatherings save a square twin
- [x] Add profile covers to Me and public host pages, plus cropped offer covers
- [x] Verify real cover saves, signed-out host display and profile removal/fallback; 390px crop controls in English and Spanish
- [x] Team invite link explainer card with QR and 3 steps

# N2 — Home, hosts, pricing and menu
- [x] Public navigation to Discover, hosts and pricing; signed-in Discover access
- [x] Guest-focused landing, Pilates, all categories and custom Other labels
- [x] Bilingual hosts page, vignettes, hosting steps, leader band, FAQ and sticky action
- [x] Public pricing using existing plan limits and monthly/annual prices
- [x] Landing sticky CTA experiment flag and analytics
- [x] Verify English and Spanish at 390px and 1440px

# N3 — Event setup (one part at a time)
- [x] 1. Quick create (title, time presets, place, Publish; More options opens full form)
- [x] 2. Smarter time presets learned from each host
- [x] 3. More repeat options
- [x] 4. Team sign-ups (host picks per-person or per-team pricing)
- [x] 5. Social share kit
- [x] 6. Promo codes

## N4 — Messaging
- [x] Group chat links beyond WhatsApp (6 platforms, several per team/gathering) + Telegram share everywhere
- [x] Text invites with Reply IN / SI, OUT / NO cancel, confirmations via outbox, admin "Simulate reply"

## V2 — Status & recognition (in parts)
- [x] Part 1: featured badges (up to 3, star toggle on badge wall, shown on Me, member detail, public host page), 7 auto milestone medallions (10/25/50/100 check-ins, 1-year member, first hosted gathering, 10 regulars), Member of the Month (leader tool + team card, mirrors Host of the Month). Migrations 0009–0011; fixed team_members.joined_at + rsvps.guest_email/phone column bugs in evaluate_milestones.
- [x] Part 2: limited badges + collection sections
- [x] Part 3: founding seats, early access, waitlist position, real capacity chips
- [x] Part 4: personal progress, month recap, coach sharing

## V3 — Coaches (in parts)
- [x] Part 1: launch checklist, earnings milestones, price guidance
- [x] Part 2: verified coaches + reviews
- [x] Part 3: retreats and trips
- [x] Part 4: ethical access
- [x] Part 5: who-it's-for messaging

## U1 — Money
- [x] Two plans (Free 7% capped at $99/month, Pro $99/month at 0%), plan_settings, fees-this-month, legacy subscribers kept
- [x] U2: guest service fee (3% + $0.49) on paid tickets, coach can cover
- [x] U3: founding coaches (admin screen, shared clock, free Pro then $49 locked, badge, Discover featuring, commitments)

# Beta readiness — October 22
- [x] Install supplied ZoheeWell logos with light/dark variants and matching browser/home-screen icons
- [x] 1. Finish ZoheeWell rebrand wording (headline, voice) + remove test event from public pages
- [ ] 2. Real end-to-end test of the core loop with two test accounts: sign up → create event → share → guest RSVP → check-in → recap
- [ ] 3. Fix everything step 2 finds (signed-in screens on phone + desktop)
- [ ] 4. Add /help and /safety pages + in-app "Report a problem / feedback" button for beta testers
- [ ] 5. Turn on real email — already wired (simulated); waits on your email domain later
- [ ] 6. Beta invite gate: invite-code signups + beta banner
- [ ] 7. Load speed on phones (first screen under 2s)
- [ ] 8. Nick's notes: Learn → Resources, customer challenges, coach templates in picker
- [ ] 9. Final security scan, publish, beta tester checklist
- Parked until after beta: text messages, AI drafts, team map, People list

# Payments — October 23
- [x] Enable built-in payments; test environment created
- [x] Add the four plans already in the app to the payment provider: Pro $99/mo, Advanced $49/mo, Team 25 $199/mo, Team 100 $499/mo (each with a software-subscription tax code)
- [x] Confirm purchase / cancel / upgrade / downgrade behaviour with Nick: cancel keeps access to month end, downgrade applies at month end, failed payment keeps access while it retries, only plans and team licenses are sold for now
- [x] Point checkout and the payment notifications at the new connection so checkout actually runs
- [x] Switch checkout to the inline payment form with tax and compliance handling turned on
- [x] Add the test-mode notice so preview buyers know no real money moves
- [ ] Verify a real test purchase end to end and read the result back in the app — automated card entry stopped at "Processing" with nothing recorded, so this needs a person paying in the preview with 4242 4242 4242 4242
