# Prompt 2: Stabilize the domain model, permissions and configuration (plan)

This plan is checked against commit `b348a6d766ec22d071f229232bb4434c7a222327`, the current latest version.

The later build turn makes database and permission changes only:
- no screen redesign;
- no provider gets switched on;
- no business data is migrated except additive backfills of new version columns;
- feature behavior stays the same, except where current rules break the privacy requirements in Blueprint v4 (see section 8).

## 0. Evidence used
- **Verified in database (this turn):**
  - Columns of events, rsvps, payments, offers, offer_purchases, plan_settings, billing_accounts, waivers, waiver_acceptances, profiles, team_members, founding_program, stripe_events, tracks and lessons.
  - Policy names on 19 core tables.
  - The names of all fee, RSVP, guest, permission (`can_*`) and `is_team_member` functions.
  - `current_fee_pct` source.
  - plan_settings rows: free 7%, growth 2%, pro 0%, plus a 3% + 49¢ guest service fee.
- **Verified in the repository:**
  - Migration history is `drizzle/migrations/0000–0046` (48 files) plus 47 legacy `supabase/migrations` files.
  - `supabase/AGENTS.md` lists which functions own each data path.
- **Assumed (re-read at build time, before any SQL):**
  - The full source of every `can_*` and `is_team_member` function.
  - Policies on the remaining ~80 tables.
  - Whether `stripe_events` is used as the webhook duplicate filter, as `webhook-events.server.ts` suggests.
  - The exact list of code that reads each table, found by searching `src/`.

## 1. Current tables and functions, by area (inventory)
| Area | Tables | Key functions | Main code that uses it |
|---|---|---|---|
| Identity / adult | profiles, user_roles, user_suspensions | has_role, delete_my_account | onboarding, me, admin |
| Teams / roles | teams, team_members (role), team_licenses, license_seats, team_suspensions | is_team_member (ancestor leaders inherit), team_tree, create_team, join_team_by_code, transfer_leadership | team, plan_.seats |
| Hosts / public profile | profiles.slug, follows, locations | get_public_host, get_public_team | h.$slug, hosts |
| Events | events (series_id, recurrence, retreat, capacity, price_cents, refund_policy, community_seats), event_cohosts, rsvps, rsvp_answers, waivers, waiver_acceptances, promo_codes, payments, event_checklists | rsvp_event(_full/_waiver), decide_rsvp, check_in_code/rsvp, can_manage_event, can_view_event, on_rsvp_freed (waitlist), check_promo, platform_fee_cents, service_fee_cents | gathering form, event detail/guests/checkin, e.$id |
| Learning | tracks, lessons, lesson_progress, lesson_summaries, lesson_live_links, recipes | can_read_track, can_edit_track, track_progress | learn routes |
| Resources | offers (kind, file_path, drip_days), offer_purchases | join_free_offer | offers, offer.$id |
| Memberships | offer_purchases (stripe_subscription_id, renews_at) | — | offers |
| Platform plans | billing_accounts, plan_settings, founding_program, founding_coaches, member_plans | effective_plan, plan_limits, current_fee_pct, accept_founding | plan page, billing.functions |
| Payments / Connect | billing_accounts.connect_account_id/connect_status, payments, stripe_events | webhook-events.server.ts, two webhooks (/stripe, /payments) | earnings, plan |
| Messaging / consent | notification_outbox, delivery_events, email_prefs, email_suppressions, sms_optouts, sms_invites, push_subscriptions; consent flags on rsvps | enqueue_message, claim_outbox, queue_rsvp_reminders | notify/process.server.ts |
| Moderation / audit | reports, admin_audit, comments, shoutouts | report_content, moderate_comment, admin_* | admin console |
| Configuration | feature_flags, app_config, plan_settings | feature-flags.tsx | everywhere |

## 2. Gap matrix
| Item | Decision |
|---|---|
| profiles, user_roles, teams, team_members, is_team_member | Reuse. Add an 18+ confirmation record (`age_attested_at`). |
| Assigned managers | Add `offering_managers` (offering type + id, user, role). Generalizes event_cohosts, which stays and is backfilled. |
| events, rsvps, waitlist trigger, check-in | Reuse. |
| Multi-day sessions | Add `event_sessions`. |
| Ticket tiers | Add `ticket_types`, with `rsvps.ticket_type_id`. |
| Add-ons | Add `event_addons` and `order_items`. |
| Promo codes | Reuse promo_codes and check_promo. |
| Waivers / waiver_acceptances | Modify: store the exact accepted text hash and version id. Add `consent_text_versions` and `guardian_consents` (adult, minor name/age, version). |
| Orders and refunds | Add `orders` (idempotency_key, fee_rule_id, amounts snapshot) and `refunds`. payments is deprecated-but-retained, readable as legacy orders. |
| Courses / sections | Courses reuse tracks. Add `course_sections`; lessons gain `section_id` and content asset fields. |
| Quizzes, certificates | Add `quizzes`, `quiz_questions`, `quiz_attempts`, `certificates`. |
| Entitlements | Add one `entitlements` table (user, offering type + id, source order or subscription, starts/ends). All access checks go through `has_entitlement()`. |
| Resources | Reuse offers, with kind = resource; offer_purchases feeds entitlements. |
| Memberships / course subscriptions | Reuse offers (subscription kinds) and offer_purchases; access through entitlements. |
| Platform plans | Reuse billing_accounts. Add `price_versions` (monthly/annual) and `plan_limit_versions`. plan_settings fee columns become deprecated-but-retained. |
| Founding offer | Modify: add `founding_grants` (activation, ends_at, notice_sent_at, annual_offer_used); founding_program stays. |
| Connect | Add `connected_accounts` (host, account id, status, payouts_enabled), backfilled from billing_accounts.connect_*. Add `payouts` (order → transfer, release_after). |
| Fees | Add `fee_rules` (versioned) and `calc_platform_fee(order)`. `current_fee_pct` and `service_fee_cents` are kept for legacy rows only. |
| Provider events | Modify stripe_events into a provider-event log: provider, event id unique, payload hash, processed_at, error. |
| Consent | Add `marketing_consents` (per host × channel, granted/revoked, text version, source). rsvps opt-in flags stay as transactional settings. |
| Outbox / delivery | Reuse. |
| Reports, admin_audit | Reuse. Add `audit_events` for non-admin sensitive actions (exports, contact reads, refunds). |
| Support | Add `support_requests`. |
| Analytics | Reuse via host-scoped functions; no raw contact data. |
| Feature flags | Reuse, plus `config_versions` for change history. |
| Excluded features | Park (no deletes): coach_reviews, testimonials, shoutouts, activity feed/reactions, comments, network, playbook. |

## 3. Migration sequence
Each step is additive, flag-free at first, and has a forward fix.

1. **0047 config_and_versions:** fee_rules (seed the legacy rows plus `v4_flat_5`, effective 2026-10-23), price_versions, plan_limit_versions, consent_text_versions (seeded from current waivers), config_versions.
2. **0048 identity_and_managers:** age_attested_at, offering_managers (backfilled from event_cohosts and event host), `can_manage_offering()`.
3. **0049 privacy_tightening:** replace the rsvps, rsvp_answers, waiver_acceptances and outbox read policies with "host or assigned manager of that offering". Leaders get count-only functions.
4. **0050 orders_ledger:** orders, order_items, refunds, provider-event log columns, idempotency keys. A backfill view maps payments into orders with `fee_rule_id = legacy`.
5. **0051 connect_and_payouts:** connected_accounts (backfill), payouts.
6. **0052 events_extended:** event_sessions, ticket_types, event_addons, guardian_consents.
7. **0053 learning:** course_sections, lesson asset columns, quizzes and quiz tables, certificates.
8. **0054 entitlements:** entitlements, has_entitlement(), backfill from offer_purchases and paid RSVPs.
9. **0055 founding_and_plans:** founding_grants, annual prices.
10. **0056 consent_and_support:** marketing_consents, support_requests, audit_events.
11. **0057 grants_hardening:** revoke anonymous EXECUTE from security-definer functions that aren't guest functions. The linter found 77 callable by anyone.

**Rollback and forward fix:**
- Every step only creates things or adds nullable columns, so a step is undone by flipping config, not by dropping anything.
- If a step fails, the migration tool rolls it back automatically.
- If a step applied but is wrong, the next numbered migration fixes it. Nothing is ever reset.
- Before going live, every migration is applied to a draft copy of the database, with a row-count and checksum comparison.

## 4. Access matrix (database rules plus server validation)
| Actor | Can read | Can write |
|---|---|---|
| Public | Published public offerings, host public profile, prices, active fee rule | Nothing |
| Guest (code/token) | Own RSVP and order by code; event-day photos after check-in | RSVP, cancel, waiver and guardian consent, marketing consent, all only through guest functions |
| Attendee / learner | Own RSVPs, orders, entitlements, progress, attempts, certificates, consents | Own progress, attempts and consents; purchases go through checkout functions only |
| Host | Own offerings and their participants, orders, consents and analytics | Own offerings, tiers, add-ons, promos and managers; refund requests |
| Assigned manager | Participants of the specific offering only | Check-in; content edits if the role allows |
| Team leader | Team roster, team-scoped content, aggregate counts | Team content, membership; no attendee contacts unless also host or manager |
| Moderator | Reported items | Moderation actions (audited) |
| Admin (has_role) | Everything through audited admin functions only | Audited admin actions |
| Webhook / provider | — | Provider-event log, orders, entitlements, payouts, using the signature-verified service role only |

Payment, entitlement, consent, check-in and fee values are always calculated on the server; amounts or statuses sent from the browser are ignored.

## 5. Versioning design
- **fee_rules:** id, code, percent, fixed_cents, cap_cents, applies_to[], effective_from, effective_to. Every order stores `fee_rule_id`, gross, discount, `platform_fee_cents`, currency and the calculated amounts at purchase time.
  - v4 rule: 5%, fixed 0, no cap, applies to every paid host-generated offering.
  - Free products: the fee function returns 0.
  - Stripe processing fees are stored separately (`processor_fee_cents`) from webhook data.
- **price_versions:** plan, interval (month/year), amount, effective range, Stripe lookup key. Annual price = 10 × monthly. Subscriptions keep their recorded price_version_id.
- **plan_limit_versions:** plan, limits JSON, effective range.
- **consent_text_versions:** kind (waiver, guardian, marketing_email, marketing_sms, terms), owner (team or platform), locale, body hash, version.
- **Refund defaults:** stored in config_versions; each order snapshots its refund policy text.
- **Feature flags:** every change also writes a config_versions row and an audit row.

## 6. Tests (to be added at build time)
All database tests run inside a transaction that is rolled back, using isolated test data (made-up users and teams). Nothing persistent is touched.

- **Isolation:** host A versus host B (each with an event, course, resource, orders, consents and analytics). Every SELECT, UPDATE and DELETE across hosts returns 0 rows or is refused.
- **Leaders:** a leader of the parent team gets roster and counts but zero participant contact rows; an assigned manager sees only their offering.
- **Historical economics:** legacy payments recompute to their stored fee under the legacy rule; new orders use 5%; free orders 0; changing plan_settings doesn't change past rows.
- **Idempotency:** the same provider event id twice gives one order and one entitlement; the same checkout idempotency key twice gives one order.
- **Migrations:** apply to a draft copy; compare row counts and checksums before and after; re-run the forward fix; confirm no DROP or TRUNCATE in the SQL (static check).
- **Pure fee and price math:** unit tests in `src/lib/fees.test.ts`.

## 7. Verified versus assumed
- **Verified:**
  - Today's rsvps, waiver_acceptances and outbox read rules let team leaders see guest details, through `is_team_member` with ancestor leaders. This breaks the v4 privacy rule.
  - Payments has no fee version.
  - The fee ladder and guest fee are live in plan_settings.
  - Connect fields exist on billing_accounts, but there is no payouts table.
  - There are no tables for quizzes, certificates, ticket types, add-ons, guardian consent or entitlements.
- **Assumed:** the rest of the inventory, the full function bodies, and that payments rows were never real charges (0 provider events recorded).

## 8. Decisions still open (none reopen v4)
1. **The leader privacy fix changes current behavior:** leaders will stop seeing guest contacts. v4 requires this; please confirm it may ship in this foundation step rather than later.
2. **Refund default for new paid offerings,** such as "host sets policy; default no refunds within 24 hours". v4 asks for versioned defaults but gives no value.
3. **When payouts are released after an event:** for example 2 days after the event ends.

## 9. Files likely to change at build time
- New migrations `drizzle/migrations/0047–0057`.
- `src/integrations/supabase/types.ts` (regenerated automatically).
- New code: `src/lib/fees.ts` and its tests, `src/lib/billing/webhook-events.server.ts` (idempotency), `src/lib/entitlements.server.ts`.
- New database tests under `src/lib/__tests__/rls/*.test.ts`.
- Updated docs: `supabase/AGENTS.md`, `AGENTS.md`, `CHANGELOG.md`.

No screens, styles or translation text change. No provider gets switched on.
