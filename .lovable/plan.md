# Prompt 0 — Audit and freeze the current build (report only)

Audited commit: `fe1db59b94ae8c3792f1f3fcf4ec4dc66ae49ffa` (confirmed as current HEAD). No code, schema, data, provider or design changes in this step. The only output is a new report file, `BETA_AUDIT.md`, written after approval.

## Already confirmed before planning
- Docs present: PROJECT_RULES, DESIGN_RULES, FEATURE_INVENTORY (108 lines), LAUNCH_REVIEW (93), SECURITY_NOTES (22), DEAD_CLICKS (161), CHANGELOG, DESIGN_AUDIT, MOBILE_AUDIT, AGENTS, roadmap, README.
- 47 migrations, ~16 test files, 99 public tables, public routes: /, discover, hosts, studios, pricing, credits, e, h, l, t, i, r, join, login, admin-login, legal, terms, privacy, unsubscribe, sitemap.
- Conflicts with Blueprint v4 already visible:
  - Palette: tokens use #35263F / #F4C7A1 / #F7F0F0 / #E8E3EC; v4 requires #302338 / #C78E76 / #D8D0C6 / #F8F5F0. Hardcoded hex values in styles (for example #35263F, #2F2340, #7A5FA8, #fff).
  - Fee: saved memory and code use Free 7% capped $99 / Pro 0% (`current_fee_pct`); v4 requires a flat 5% on all paid host sales.
  - Plans: products exist for Advanced $49, Pro $99, Team 25 $199, Team 100 $499 monthly only — no annual (10x) prices; founding program rules differ from v4 (6 months, no card, 30-day notice, 20% off first annual year).
  - Payments: current checkout is platform-as-merchant; v4 needs Stripe Connect with host as merchant of record and post-event payouts. Sandbox test purchase never completed.
  - Spanish is currently paused by user request; v4 requires bilingual UI — needs explicit decision.
  - Saved rule "paid tickets/challenges off" conflicts with v4 paid events/courses/resources/memberships.

## What the audit will do
1. Read every source listed in the request (docs, routes, components, migrations, RLS policies, DB functions, server functions, tests, feature flags) and list each inspected file in the report.
2. Map each v4 beta capability to routes, components, tables, policies and provider state, and mark it RETAIN / MODIFY / BUILD / PARK / REMOVE FROM NAVIGATION.
3. Label every finding by evidence: source review, automated test, browser (Playwright phone 390 + desktop 1440, signed-in as an existing account), real provider, or unverified assumption.
4. Run read-only checks: existing test suite, security scan results, database linter, row counts for sample/test data, feature-flag values, secrets presence (names only).
5. Flag: placeholder/temporary favicon and logo uses, old palette, old pricing and fee text, untranslated or English-only critical strings (es.json parity + hardcoded strings), sample activity/seed rows (`sample_gatherings`, demo events), and false success states (outbox "simulated" shown as sent, follow-up/broadcast "sent", reminders, SMS invites, wallet passes).
6. List beta exclusions currently present in the product (shoutouts/activity feed and reactions, coach reviews, comments, testimonials, AI assistant, MLM-style referral/badge/recognition, Team Map, Network) with a navigation recommendation.

## Capability coverage (to be marked in the report)
Discovery + empty-market message; host onboarding/profiles/teams/roles; creator dashboard/analytics; i18n; free/paid events, retreats (multi-day), ticket tiers, capacity, waitlists, add-ons, promo codes, waivers, guardian consent, guest checkout, RSVP, QR check-in, Apple/Google Wallet, email/SMS; courses/sections/lessons/media/quizzes/progress/certificates/course purchase + subscription; resource library + access control; memberships; Stripe Checkout + Connect, 5% fee, post-event payouts; platform plans + annual + founding; brand; WCAG 2.2 AA; exclusions.

## Migration and rollback strategy (proposed)
- Additive only: new tables/columns nullable or defaulted; old columns marked `DEPRECATED` by comment, never dropped.
- Feature flags gate every new domain; old flows stay until the replacement passes its test gate, then are hidden from navigation.
- Pricing/fee changes via new `plan_settings` rows and versioned fee function; legacy subscribers keep existing prices.
- Rollback = flip the flag off and revert app code; no data deletion. Sample data removal is a separate, user-approved data step.

## Dependency map for Prompts 1–17 (draft, finalized in report)
```text
1 Brand tokens + logo + palette        -> gate: contrast AA, visual diff
2 i18n decision + string parity        -> gate: es/en parity test
3 Roles/teams/permissions + RLS audit  -> gate: RLS tests per role
4 Nav cleanup / park exclusions        -> gate: dead-click re-run
5 Discovery + empty market             -> gate: browser, no-data state
6 Host onboarding + profiles           -> gate: two-account flow
7 Events core: tiers, capacity, waitlist, add-ons, promo  -> gate: unit + browser
8 Retreats (multi-day)                 -> depends 7
9 Waivers + guardian consent           -> depends 7
10 Stripe Connect onboarding (host MoR, 5% fee) -> human approval
11 Guest checkout + paid tickets + payouts after event -> depends 7,10
12 QR check-in + Wallet passes         -> credentials needed
13 Email/SMS comms (real delivery)     -> domain + Twilio
14 Courses/lessons/quizzes/certificates + purchase/subscription -> depends 10
15 Resource library + paid access      -> depends 10
16 Memberships + platform plans/annual/founding -> depends 10
17 Dashboard/analytics, WCAG 2.2 AA pass, security scan, publish -> all
```
Key risks: Connect changes merchant model (tax/refund liability), fee change affects existing hosts, Spanish pause vs bilingual requirement, wallet pass certificates, guardian consent legal wording.

## Will need secure credential forms or human approval later
- Stripe Connect activation, live mode, tax registration country, payout schedule.
- Apple Wallet pass certificate + Team ID; Google Wallet issuer account + service key.
- Email sending domain (DNS), Twilio account SID/token/number, Retell AI key (premium, later).
- Any destructive data cleanup (sample rows), breaking schema change, fee/price change for existing customers, legal text (waiver, guardian consent, terms).

## Decisions I need from you (will be listed in the report too)
- Re-enable Spanish now, or keep paused until a later prompt?
- Confirm 5% replaces the saved 7%/Pro 0% rule for all hosts, including Pro.
