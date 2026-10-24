> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# Gatherwell Feature Inventory

Snapshot: 2026-10-16. Status comes from reading the source plus spot checks. It is not a full click-through test.

Status key: **Working** · **Sample data** (shows sample data) · **Not connected** (waits on an outside account) · **Unfinished** · **Broken**

Feature flags today: `landing_testimonials` (on), `landing_headline` (off), `landing_sticky_host_experiment` (off). These flags only affect the marketing home page. No app route is behind a flag.

Outside accounts not connected yet: email (Resend/Mailgun), text (Twilio), push keys, payments (Stripe), maps, AI. Without them, messages are logged as **simulated** (see Admin > Mail), paid checkout stays blocked behind a clear notice, and AI returns preview text.

## Guest (no account)
| Route | What it does | Status | Flag |
|---|---|---|---|
| /e/$id | Public gathering page and RSVP (free), waiver, questions, waitlist, terms consent, ticket tiers (paid tiers Setup required) | Working (confirmation email is simulated) | No |
| /e/$id paid | Ticket checkout | Not connected (Stripe) | No |
| /i/$code | Invite link that leads to a gathering RSVP | Working | No |
| /r/$code | Referral link | Working | No |
| /events?tab=tickets | Signed-in My tickets: status, waitlist position, waiver/terms records, cancel, private join link | Working (verified live 2026-10-24, EN/ES, phone/desktop) | No |
| /join/$code | Join a team from an invite code | Working | No |
| /unsubscribe/$token | Email preferences and opt-out | Working | No |
| Text replies IN/OUT/STOP | RSVP by text reply | Not connected (only admin simulation) | No |

## Member (signed in)
| Route | What it does | Status | Flag |
|---|---|---|---|
| /home | Personal Home: upcoming RSVPs, team activity | Working | No |
| /events | Upcoming / Hosting / Past tabs | Working | No |
| /progress | Badges, milestones, goals | Working | No |
| /circles | Joined Circles | Working; members' space is Unfinished (ME5) | No |
| /challenge/$id | Challenge check-ins, leaderboard | Working | No |
| /learn (Resources), track, lesson, recipes | Events-style Resources tabs/filters, one card system | Working (v0.31) | No |
| /learn/create | Type-first chooser: 10 resource types route into preset editors, drafts only | Working (v0.32) | No |
| /learn/templates | Resource templates: 6 ZoheeWell starters + team templates, copy to draft | Working (v0.31) | No |
| /me | Profile, privacy, notifications, language | Working | No |
| /onboarding | First-run choice: guest or host | Working | No |

## Host
| Route | What it does | Status | Flag |
|---|---|---|---|
| /start | Host setup checklist | Working | No |
| /gathering/new, /gathering/$id/edit | Create or edit a single gathering or weekly series | Working; no category in quick create | No |
| /event/$id | Host view of a gathering | Working | No |
| /event/$id/guests | Guest list, approvals, co-hosts | Working | No |
| /event/$id/checkin | QR/code check-in, walk-ins | Working | No |
| /offers, /offer/$id | Circles and offers | Free offers Working; paid Not connected | No |
| /promos | Promo codes | Working (only matter once paid is live) | No |
| /earnings | Payouts and earnings | Not connected (Stripe) | No |
| /plan | Plan and limits (Free / Advanced / Pro) | Upgrade Not connected (Stripe) | No |
| /locations | Studios and spaces | Working | No |
| /followups | AI follow-up drafts | Not connected (AI); preview text | No |
| /verify | Coach verification request | Working (not required yet) | No |
| /h/$slug | Public host page | Working; link preview image Unfinished | No |
| People list (PE1 to PE3) | Guest list with statuses | Unfinished (not built) | No |

## Leader / Team
| Route | What it does | Status | Flag |
|---|---|---|---|
| /team | Team space: members, activity wins, announcements, shout-outs | Working | No |
| /team/insights | Activity counts (never sales) | Working | No |
| /team/map | Team map | Not connected (maps key); list fallback | No |
| /plan/seats | Team License seats | Working (license purchase Not connected) | No |
| /learn/manage | Publish trainings | Working | No |
| /network | Host connections and shares | Working | No |
| /t/$slug | Public team page | Working | No |

Specifics:
- **Inviting a whole organization:** join code / invite link per team (`/join/$code`), with inviter tracking. No bulk email/CSV invite. Partly done.
- **Sub-teams:** create sub-teams; leaders see the whole tree in the team and calendar views. Working.
- **Templates and launching them:** leader templates plus starter templates; launch creates the gathering and copies the checklist. Working.
- **Team activity / rhythm:** activity wins feed and Insights counts. There is no "weekly rhythm" view. Partly done.
- **Monthly team reports:** none. Not built.
- **Recognition / Host of the Month:** Host of the Month, Member of the Month, leader-awarded badges, automatic badges. Working.
- **Team Licenses and seats:** seat assignment works. Buying 25/100 seats is Not connected (Stripe); admins can grant a preview license.

## Admin
| Route | What it does | Status | Flag |
|---|---|---|---|
| /admin?tab=overview | Platform totals | Working | No |
| teams / users | Search teams and people, actions | Working; scorecard and timeline Unfinished (AD3) | No |
| moderation / verify | Reports and verification queue | Working; unified Trust inbox Unfinished (AD7) | No |
| library / broadcasts | Starter content and announcements | Working | No |
| founding / day60 | Founding coaches, Day-60 scoreboard | Working | No |
| settings | Plan prices and fees | Working | No |
| audit | Admin action log | Working | No |
| mail | Outbound message log with filters and counters | Working (new; shows simulated while no senders) | No |
| /admin/site-media | Site photos | Working | No |
| Analytics funnel (AD5/AD6) | | Unfinished (not built) | No |

## Public pages
| Route | What it does | Status | Flag |
|---|---|---|---|
| / | Marketing home | Working (testimonials flag on) | Yes, partly |
| /discover | Find gatherings | Working; uses sample gatherings when there are few real ones | No |
| /hosts, /studios, /pricing | Marketing pages | Working | No |
| /l/$slug | Public location page | Working; link preview image Unfinished | No |
| /login | Google and email link sign-in | Working | No |
| /terms, /privacy, /legal/$doc, /credits | Legal pages | Working | No |
| /help, /safety | | Unfinished (missing) | No |
| /sitemap.xml | Sitemap | Working | No |

## The 10 places a brand-new host is most likely to get stuck
1. Expecting confirmation emails to arrive. They are simulated until an email service is connected.
2. Trying to charge for a gathering. Paid checkout is blocked until payments are connected, so free is the only working path.
3. Not knowing which first step to take. Home vs `/start` vs "New gathering" compete.
4. The RSVP form is longer than guests expect (several fields), so hosts worry about drop-off.
5. No category in quick create, so gatherings look generic in Discover.
6. Sharing a link and getting a plain preview card (no host photo or price) on social apps.
7. Seeing leftover sample tracks and sample gatherings and wondering what is real.
8. Reminders are off by default; hosts assume guests are reminded.
9. No Help or Safety page to turn to.
10. No People list yet, so it is hard to see who came back or who is slipping.

## Update — Prompt 2 foundation (2026-10-23, active)
- Team leaders no longer read guest RSVPs, answers, waiver records or event outbox; only hosts and assigned co-hosts do. Text-invite candidates limited to the caller's own hosted/co-hosted events.
- Signed-out callers can no longer run 19 functions (10 trigger-only, 9 signed-in-only). 58 public-callable security-definer functions remain, mostly guest RPCs; the full allowlist review is pending.
- New versioned fee, price, consent, refund and payout policy tables; orders ledger, entitlements and provider event log exist but are not yet used by checkout.

## Identity and onboarding (Prompt 3)
- Built: deep-link return through sign-in and onboarding, 18+ attestation, three starts, view switch, invite expiry, guest claim, Spanish on, server 18+ on checkout.
- Database only (no screen yet): guardian child registration, host allows_minors toggle.

## Public homepage (v0.29)
- Host-first homepage: short hero pitch + marketing carousel (Events/Retreats/Courses/Communities, approved category imagery, manual controls, no auto-advance), three concise host tool cards linking to /hosts, one attendee band, one-line pricing teaser linking to /pricing, single trust line. The homepage renders no event records, so drafts/templates/tests cannot surface there; real discovery lives on /discover.
- Notify me (area alerts): live on /alerts (v0.23). Payments, paid SMS, Wallet, payouts: labelled coming soon where shown.
- Public pricing (/pricing, /hosts, /studios): approved 2026-10-24 plans with the per-plan fee ladder (5/3/2/1/0.5%), builder seats (3/3/5/25/100), monthly/annual toggle and "Which plan is right for me?" guide; Organization is Contact sales (assisted setup); paid checkout Setup required; payouts Coming soon. Builder-seat enforcement is server-side (migration 0088): only owner/admin/host/content_editor consume seats in invite, accept and role change.
- Signed-in plan screen (v0.15): prospective cards show approved v4 prices and the flat 5% fee; current/legacy subscriptions keep their real recorded status; paid checkout disabled until approved prices are configured in plan_settings and Stripe.
- Course quizzes (v0.22): host authoring (4 question types, keys, points, reorder, blockers, attempts/cooldown/time limits), server grading + manual short-answer, learner taker with timer/autosave/idempotent submit, progress panels and host completion rules.
- Certificates (v0.22): host settings, server-verified idempotent issuance, printable card in My learning, public /verify/$number page, host revoke with reason.
- Unified discovery (v0.23): /discover catalogs published public events, courses, resources, memberships with search, type/category/date/format/free/language/accessibility/family/radius filters, shareable URLs, truthful counts; samples and non-public content excluded server-side.
- Saved (v0.23): signed-in save/unsave on offerings + /saved list; items that go private drop out automatically.
- Location alerts (v0.23): coarse-location alerts with pause/resume/delete and in-app matches; email/SMS delivery Setup required.
- Invite a host (v0.23): opaque attributed share token, recorded once after signup, self-referral rejected.
- Host public profiles (v0.24): host-controlled org, categories, languages, accessibility statement, allowlisted links, city opt-in, publish/unpublish, readiness checklist, preview; public page shows only published public offerings; Person/Organization structured data from real fields.
- Following (v0.24): signed-in follow/unfollow is idempotent; /following lists still-public hosts/teams; hosts see aggregate counts only.
- Team workspaces (v0.25): 8 workspace roles with centralized server-side capability checks, email invitations via copyable one-use links (email delivery Setup required), seat usage vs real entitlement with invite blocking, member suspend/remove/role change, ownership transfer with typed confirmation, and an owner/admin audit activity log.
- Communications/check-in QA (v0.26): signed-in browser verification passed 64/64 at 390px and 64/64 at 1280px, plus 14/14 at 200% zoom with reduced motion. Scanner focus/Escape/restore, sheet focus restoration, 44px brand target, query-cache console noise and haptics activation were fixed. All temporary fixture rows, including the fixture auth account, were fully removed with zero-count proof. Screen-reader narration and real-device camera permission remain manual checks.
- Host insights (v0.27): /insights dashboard with real per-event registration/attendance/waitlist/cancellation counts, per-offering enrollments/learners/certificates, and real order-ledger sales (honest empty state when none); team aggregate section gated to owner/admin/analyst; aggregate-only CSV exports. Verified live and in browser (17/17, EN/ES, phone/desktop).
- Admin support triage (v0.27): /admin?tab=support lists tickets by state (display names only), staff replies through the existing rate-limited RPC with in-app member notification, close with audit. RPC denial for non-admins verified live.
- Privacy & data (v0.27): Me > Privacy & data panel with server-authorized Download my data (JSON, caller's own rows only — verified live) and consent history (18+ attestation, terms, waivers, guardian consents, marketing preferences).
- Platform safety (v0.28): admin-only paginated People/Workspaces/Offerings, filtered report lifecycle (self-assignment/escalation/resolve/dismiss), reversible supported hiding/unpublishing, separate scoped community restrictions, workspace suspension/reactivation, existing account bans, privacy-minimized audit history. 294 tests; 28 admin page checks, 8 keyboard checks, 17 non-admin denial/UI checks and 15 live safety-action checks. EN/ES, 390px/1280px, no overflow/console errors. All Fx28 fixtures fully removed (140 public-table scan + exact auth counts zero). Account ban boundary, screen-reader narration, saturation test and nonempty admin Support interaction remain unverified; see v0.28 CHANGELOG.
- v0.28.1 supersedes the preceding verification gaps: 303 tests/41 files; 37 live admin/anon assertions + 60 four-role denial/RLS assertions; four function grant rows checked; rollback-wrapped action/scope/Support checks passed. Search saturation: 66 requests, 12 safe rejections after 54 accepted requests with existing window usage. Nonempty Support browser checks 20/20 (EN/ES,390/1280); account UI/Auth lifecycle 22/22 (EN phone/ES desktop). Support audit is atomic; community/workspace retries no-op; account record/audit is atomic with checked managed-auth compensation. Exactly six Fx29 auth identities deleted and 140 public-table scan returned zero. Manual narration/device checks and cross-service atomicity caveat remain; exact evidence/limits in CHANGELOG v0.28.1.

