# Readiness, privacy and waiver worksheet (rows 92, 100, 118, 91)

Dated 2026-10-30. Built from code and database evidence only. **No counsel has reviewed anything in this file. Nothing here is legal advice or a statement of compliance.** Every "Decision needed" line waits on a named owner.

## Row 100: launch readiness (checked 2026-10-30)

| Capability | What the code needs | Present now | Effect today |
|---|---|---|---|
| Payments (test) | `STRIPE_SANDBOX_API_KEY` + `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Both present | Platform reads as connected for the test environment. Paid selling is still off by the launch switch `feature_selling`. No test checkout was run this pass. |
| Payments (live) | `STRIPE_LIVE_API_KEY` | Missing | Live charges impossible (correct for beta) |
| Transactional email | `RESEND_API_KEY` | Missing | Messages are marked simulated, never shown as sent |
| Coach announcements email | `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` | Missing | Subscriber updates are preview-only |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Missing | SMS stays disabled. Free events are not blocked |
| Map search | `GOOGLE_MAPS_API_KEY` | Missing | Typed addresses and directions links still work |
| Push | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Present | Push can be enabled by the person |
| AI summaries/assistant | `ANTHROPIC_API_KEY` | Missing | Summaries return "not turned on". No sample text |

Test journeys still to run, in order (isolated test accounts only):
1. Fresh coach and fresh attendee sign up, then switch roles.
2. Coach publishes a free event. Open the event signed out, register, check the QR, scan on a physical phone, then check the follow-up.
3. Team invite, approval, and access to one free resource.
4. Test-environment paid checkout: success, card decline, and full and partial refund. The referral reward ledger then needs to show pending, reversed and reduced (see row 91).
5. Real email and SMS delivery to staff-owned addresses only, once the keys are added.
6. Three first-time users, observed without coaching.

## Row 91: affiliate acceptance matrix

| Case | Rule (code) | Evidence |
|---|---|---|
| One paid purchase credits one affiliate once | unique `referral_rewards.order_id`, `referral_attribute_order` | DB constraint |
| Free, failed or abandoned orders earn zero | attribution only on `paid`. `rewardCents` is 0 for a zero sale | `referral-refunds.test.ts` |
| Discounts | base = gross − discount | `referral_attribute_order` |
| Partial refund | reward recomputed on what the buyer kept, using the rate snapshot | migration 0205, `adjustForRefund` tests |
| Full refund, cancel or dispute | unpaid reward reversed. A paid reward is flagged for the host to reconcile and never auto-clawed back | 0205, tests |
| Self, host or same-team referrer | excluded | `attribute()` tests, DB |
| Attribution window and competing links | last valid click within 30 days | `REFERRAL_WINDOW_DAYS` |
| Rate snapshot | `reward_kind` / `reward_value` stored per reward | 0205 |
| Hold before available | 14 days | `available_at` |
| Payout | manual only (`method = 'manual'`). "Paid" means the host recorded it. ZoheeWell sends no money | constraint, UI note |
| Invite / approve / revoke | owner invites by account email or approves a request; reject and revoke close it. Pending, declined and removed people get no link, no counted clicks and no new rewards; earned rewards stay | 0208, `referral_membership_disposable.sql`, `referral-membership.test.ts` |
| Affiliate terms | joining needs acceptance of an approved `affiliate_terms` document (EN+ES, approval reference, https URL); each acceptance is stored with version and text hash. **None is approved today, so joining fails closed** | 0208/0209 |
| Legacy links | carried over as "requested (legacy)": inactive until owner approval + terms. Production had 0 links at migration time | 0208 |
| Launch | referral rewards and paid selling stay switched off | SOURCE_OF_TRUTH launch mode |

Next action: counsel-approved affiliate terms (EN and ES) must be added as an approved `affiliate_terms` version with its reference and document link. Decision needed (owners: Nick, Michael): payout method and timing, whether the hold should match the refund policy window, how to recover payouts that were later refunded, and tax-form handling for affiliates.

## Row 92: privacy requirements worksheet

Applicability needs qualified privacy counsel, working from actual operating states, user residency, volumes and data types. Inputs we must supply to counsel:

| Data area | Where it lives (evidence) | Who can see it | Gap / decision needed | Priority |
|---|---|---|---|---|
| Account profile (name, city, photo, bio, phone) | `profiles` | self; public only for host page fields | retention period after deletion; export format | High |
| Age attestation 18+ | `confirm_adult()`; `consent_text_versions` kind `adult` (not approved) | system | approved adult attestation text | High |
| Event registrations and guest contacts | `rsvps` (37 cols) | hosts/managers of that event only (RLS) | retention after event; deletion on request | High |
| Waivers / guardian consent | `waiver_acceptances`, `event_waiver_acceptances`; waiver texts unapproved (93 EN + 93 ES drafts) | event managers | counsel-approved templates; minors handling | High |
| Health-adjacent data (wellness assessment answers) | `assessment_receipts` (private, immutable) | the learner | consumer-health-data law review (e.g. WA, NV, CT); assessment remains switched off | High |
| Payments / orders | `orders`, `payments`, `refunds` | buyer, seller host, service | processor DPA; retention for tax | Medium |
| Referral tracking | `referral_clicks` (device id / user id), `referral_rewards` | referrer sees own totals only; buyers not exposed | cookie/tracking notice; opt-out signals (GPC) not honored yet | High |
| Analytics | PostHog (`POSTHOG_KEY` not set) | — | consent banner decision before enabling | Medium |
| Messages | `notification_outbox`, `email_prefs`, `sms_optouts` | system | provider DPAs once keys added | Medium |
| Coach update subscribers | `coach_subscriptions` | counts only to the coach | double opt-in proof retained | Medium |
| Account deletion | `delete_my_account()` | self | propagation to vendors; documented retention exceptions | High |
| Access / export requests | Me → Privacy and data panel | self | appeal process where required; response SLA | High |
| Incident response | none in code | — | written breach-response plan and owner | High |

Owner for ongoing legal monitoring: **not assigned.** A decision is needed.

## Row 118: waiver and photo/video release requirements

Current evidence: host waivers are owner-only, versioned and immutable on acceptance. The platform event agreement pins on publish. **No photo/video release exists in code or data**, and no consent text is approved.

Requirements to build only after approved wording exists:
- A separate unchecked "Photo/video permission" choice, distinct from accepting participation. Declining must not block registration.
- Record the exact version, signer, timestamp and each choice separately. Show "Media: allowed / declined" to authorized event managers only.
- Decide operationally how a "declined" choice is honored (e.g. a check-in badge, or excluding them from shared event photos).
- Minors: guardian decides the media choice separately.
- Single active-language input for host-authored text. Translations must be reviewed, never machine-published.
- Tests: preview, accept, decline, saved receipt, version change, host isolation.

Inputs needed from counsel/owners: release wording per intended use (host marketing, ZoheeWell marketing, social channels), duration and withdrawal terms, jurisdictions, and activity-specific risk language. None will be invented.

## Stripe test-mode verification (checked 2026-10-30)

The test-environment keys work only through the payments gateway. Creating a test checkout charges nothing. But the full journey (checkout, then webhook, then order, entitlement, refund and referral reward) writes its results into the app's database, and that database is shared by the preview and the live site. So the journey can't run here without writing shared test records, and **it was not run**.

What a disposable run needs:
1. A draft copy of the project with its own isolated backend, with all migrations applied.
2. That draft's test-mode webhook endpoint registered and pointed at the draft only, with its own signing secret.
3. A test connected host account set up in Stripe test mode.
4. ZZ-TEST host, buyer and affiliate accounts in the draft. Approved fixture affiliate terms in the draft only.
5. Steps: paid checkout with test card 4242, a decline (4000 0000 0000 0002), a partial and a full refund, and duplicate webhook delivery. Expected: one order, one reward, the reward reduced or reversed by refunds, and an idempotent webhook.
6. Throw the draft away afterwards.
