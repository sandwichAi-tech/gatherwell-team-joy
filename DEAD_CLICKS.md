# ZoheeWell — dead-click audit (walkthrough 1.1)

**Date:** October 23, 2026 (UTC)  
**Scope:** report only, following the October 2026 section at the top of PROJECT_RULES.md.  
**Changes:** no application code, configuration, feature flags, payment setup or business records changed. Only this report, the roadmap and change log were updated.

## Summary

- **27 actionable findings:** five browser-confirmed navigation/access gaps, nineteen source-confirmed conditional or misleading action paths, and three source-only destination/availability risks.
- **Seven unfinished/service-dependent action groups** listed separately. They are not unexplained dead clicks and must not be enabled without approval.
- **Six launch flags are currently off:** Learn, Network, Retreats, limited badges, Playbook and Team Map. Administrators deliberately bypass these flags; ordinary users should not see their gated entrances.
- No missing route file was established behind the inspected primary navigation. Empty lists, invalid links, validation-disabled buttons and current-plan buttons are not automatically dead clicks.
- **First fixes to prioritize:** event-management access screens; same-page Announcement creation; Challenge/Training creation destinations; honest queued/simulated message states; payment-only launch scope; support destination.

### What was actually checked

- Source inventory of **all 59 content-route patterns**: 22 public and 37 signed-in, including onboarding. Shared layouts, menus and nested action components were also inspected.
- **120 browser page inspections**: 86 main/error-state inspections plus 34 detail/legal inspections, at **375 × 812 phone** and **1440 × 1800 desktop**. All finished loading after sufficient waits; early skeleton captures were discarded and rerun.
- **48 menu/sheet/tab observations** across both sizes, including all twelve Admin tabs and nine Me sheets; three desktop observations document the absent Create control rather than a click.
- Public Discover RSVP → correct event → guest form opened at both sizes, **without submitting**.
- Signed-in inspection used the existing authorized administrator account. A real event owned by another host established the inappropriate management destinations below. No second account was created or used.
- Read-only checks established the current six launch flags are off. No switches were changed.

### Evidence levels

**Browser + source:** observed live and confirmed in implementation.  
**Source-confirmed:** a specific action/error branch is present; its failure was not forced live.  
**Source-only risk:** depends on an unobserved role, data or service state.  
Recommendations say **wire** or **remove**; none were implemented.

## A. Browser-confirmed navigation and access gaps (5)

| ID | Screen / label | What it does now | Suggested fix | Evidence |
|---|---|---|---|---|
| D01 — High | Create menu on Team → **Announcement** | At phone size, selecting it changes the URL to `/team#announce` but opens no composer when Team is already mounted. | **Wire:** consume a router creation intent whenever it changes and open the announcement composer. | `src/components/gatherwell-shell.tsx:78`; `src/components/team-page.tsx:104`; screenshot `action-phone-create-Announcement.png`. |
| D02 — Medium | Create menu → **Challenge** | Scrolls to `/team#challenges`; the list appears, but the editor remains closed. A further **New challenge** tap is required. | **Wire:** open ChallengeEditor directly; alternatively remove it from Create and present it as a list shortcut. | `gatherwell-shell.tsx:78`; `challenges.tsx:72–83`; screenshot `action-phone-create-Challenge.png`. |
| D03 — High | Another host's `/event/:id/guests` → **Add a guest**, **Small groups**, **Export CSV** | Event detail correctly hides management links, but manually opening the destination displays management controls and an empty guest list. | **Wire:** apply the detail screen's host/leader/cohost management decision before displaying tools; show access denied and Back to event. Preserve server enforcement. | `src/routes/_authenticated/_app/event.$id.tsx:48–54,119–139`; `event_.$id.guests.tsx:74–100`; browser detail captures at both sizes. |
| D04 — High | Another host's `/event/:id/checkin` → **Scan QR**, **Add walk-in** | Direct navigation displays check-in tools despite the account not being the event manager. No check-in was attempted. | **Wire:** same permission boundary as D03; do not rely on failed actions after presenting management controls. | `event_.$id.checkin.tsx:102–123`; checked at both sizes. Check-in procedures already enforce `can_manage_event` in the migration `20261004230204_f1399a0e-446f-4c7f-8987-7d66dcb3a6e3.sql:125–151`. Not a demonstrated server bypass. |
| D05 — Medium | Desktop Team/shared shell → **Create (+)** | The phone's shared Create menu has no visible desktop equivalent. Team's individual tools remain, but the global action set cannot be opened there. This is an absent entry point, not a literal dead button. | **Wire:** provide a visible desktop Create action with the same permitted choices. | `src/styles.css:46` hides `.floating-create`; `gatherwell-shell.tsx:73`; all three desktop Create checks observed not visible. |

## B. Source-confirmed conditional or misleading actions (19)

These are not universal no-ops. They have specific failure branches or promise more than the action performs.

| ID | Screen / label | What it does now | Suggested fix | Source evidence |
|---|---|---|---|---|
| D06 — High | Public event → **Register a team (min–max)**, paid teams | Opens and collects team/participant details, but priced registration cannot submit: both the handler and submit button reject it. | **Remove** the paid registration entry until checkout exists, or explicitly disable it before collecting details; later **wire** paid team checkout only if approved. | `src/routes/e.$id.tsx:143`; `src/components/team-rsvp.tsx:43,75–79`. No priced-team fixture was available. |
| D07 — Medium | Landing/Discover sample cards → **RSVP** | Changes to **Going** locally and displays a sample-preview toast; no registration occurs. Real-card RSVP also briefly says Going before navigating to the guest form. | **Wire** sample action to its existing preview sheet and label it Preview event; real cards should show a navigation state, not confirmed attendance. | `src/components/landing/gathering-card.tsx:34–46,101–108`. Real-card navigation was verified; no sample card was live in this feed. |
| D08 — Medium | Discover → **Skip to content** | Shared skip link targets `#main-content`; Discover has no matching main ID. | **Wire** target to the real content element. | `src/routes/__root.tsx:150`; `src/components/landing/discover-page.tsx:30`. |
| D09 — Medium | Host/team/location public page → **Following → Unfollow** | Delete errors are ignored; failed deletion can leave the person following without explanation. | **Wire** explicit failure feedback and only confirm success after the delete succeeds. | `src/components/follow.tsx:99–103`. |
| D10 — Medium | Email preferences → switches, **unsubscribe all**, **resubscribe** | Save errors clear busy state without explaining that the preference did not change. | **Wire** visible error/retry; clear stale saved feedback when saving again. | `src/routes/unsubscribe.$token.tsx:23–27,36–41`. Valid token was not used. |
| D11 — Medium | Team → selected member → **Save changes / Make leader / Change to host** | The write helper reports an error but resolves; its continuation still changes the selected member's local role/badge. | **Wire** explicit successful result before local update, or read back authoritative member data. | `src/components/team-page.tsx:338–343,362–367`. |
| D12 — Medium | Me → **Share my invite link / Invite friends → Share** | Native share rejection is always treated as cancellation; non-cancellation failures get no fallback. Clipboard-only branch also lacks error handling. | **Wire** copy/manual sharing after genuine share failure; preserve silent user cancellation. | `src/components/me-page.tsx:236,265`; `src/components/welcome.tsx:27–29`. |
| D13 — High | Follow-up inbox → **WhatsApp** | Opening WhatsApp immediately marks the draft sent, even if popup is blocked or the host abandons the message. | **Wire** handoff status and explicit host confirmation; do not infer sending from opening another app. | `src/components/smart.tsx:126–139`; `src/lib/smart.functions.ts:44–62`. |
| D14 — High | Follow-up inbox → **Email / Text / Send all approved** | Enqueue success marks draft sent and shows sent success, without waiting for delivery; simulated/failed provider results are not reflected by this path. | **Wire** queued/simulated/failed/delivered statuses to outbox outcomes. Keep unavailable services unavailable. | `smart.functions.ts:52–62`; `smart.tsx:135–139,174–185`. |
| D15 — High | Admin → Broadcasts → **Send a test to me / Send broadcast** | UI includes disconnected-email information, but success copy says **Test sent to you** without distinguishing simulation or queuing. | **Wire** truthful queued/simulated outcome messaging; never connect a sender as an audit fix. | `src/components/admin-console.tsx:391–403`; `admin.bc.testSent` in `src/locales/en.json`. No messages sent during audit. |
| D16 — Medium | Host rewards → **Active / Remove reward** | Mutation errors are discarded; a rejected action simply leaves the switch/item unchanged. | **Wire** error feedback, pending state and retryability. | `src/components/welcome.tsx:112–114`; `src/lib/welcome.ts:44–45`. |
| D17 — Medium | My progress → **Remove goal / Remove personal best** | Archive/delete errors ignored; item can stay with no explanation. | **Wire** mutation errors to the existing save-error message. | `src/components/my-progress.tsx:76,83`. |
| D18 — Medium | Admin → Founding coaches → **Council attendance / Remove coach** | Client ignores results; server also ignores database errors and returns success. | **Wire** server error handling and visible failure; only audit completed mutations as completed. | `src/components/founding.tsx:96–98`; `src/lib/admin.functions.ts:478–486,498–508`. |
| D19 — Medium | Admin → Day 60 → **stay-at-rate response choices** | Server can return `ok:false`; client discards it and refreshes without explaining unchanged selection. | **Wire** result checks and per-coach pending/error states. | `src/components/day60.tsx:35–37`; `admin.functions.ts:520–529`. Responses were not changed. |
| D20 — Medium | Assistant event card → **Create it** | Enabled title/date conditions do not require workspace; handler silently returns if workspace is missing. | **Wire** workspace readiness into enabled state and show recovery on failure. | `src/components/assistant/assistant-cards.tsx:24,31–33,68`. |
| D21 — Medium | Assistant cards → **Copy** | Raw clipboard call has no failure handling/fallback. | **Wire** existing shared copy helper and a visible error/manual selection option. | `assistant-cards.tsx:19,48`; `src/components/copy-button.tsx:7–14,23–25`. |
| D22 — Medium | Event Share kit → **Share** without native sharing | Ignores failed `copyText`, still announces Copied and records sharing. | **Wire** success/recording to true copy result; offer manual copy on failure. | `src/components/share-kit.tsx:116–124`. |
| D23 — Medium | Event Share kit → **Copy caption** | Failed copy gets no success or error feedback. | **Wire** failed-copy notice and selectable caption. | `share-kit.tsx:104–110`. |
| D24 — Medium | Me → **Help & feedback**; Plan → organization **Contact us** | Both open `mailto:help@gatherwell.app`, an old-brand destination. No in-app feedback form; mailbox ownership/delivery unverified and mail-client availability varies. | **Wire** confirmed ZoheeWell support/feedback destination; owner must supply/confirm the real mailbox. Do not invent one. | `src/components/me-page.tsx:282`; `src/components/plan-page.tsx` organization Contact us link; browser inspected both hrefs. |

## C. Source-only destination or availability risks (3)

| ID | Screen / label | What it does now / condition | Suggested fix | Evidence |
|---|---|---|---|---|
| D25 — Medium | Create menu → **Training** | When Learn is enabled and role permits it, navigates to default `/learn/manage` track management instead of opening a creation form. Training was hidden in the tested Create menu. | **Wire** a creation intent, or **remove** from Create and rename as Manage resources navigation. | `gatherwell-shell.tsx:78`; `src/components/learn-manage.tsx:261–271`. |
| D26 — Medium | Events without team → **Upcoming / Past**, event creation | Queries are disabled without teams and default to empty lists; local creation requires a non-member workspace while global Create offers events. Hosting has its own query. | **Wire** hosted/attended events independently of team membership, plus a no-team next action and consistent creation availability. | `src/components/events-page.tsx:37–43,47,55–58`; `src/lib/gatherings.ts:20–27`. Tested account has a team, so no-team state not reproduced. |
| D27 — Low | Home → **Create template** without workspace | Sets editor-open state, but editor only mounts when workspace exists; button lacks the adjacent invite action's missing-workspace gate. | **Wire** readiness/recovery or disable until workspace exists. | `src/components/gatherwell-pages.tsx:38–44`. Tested workspace was available. |

## D. Unfinished, service-dependent and parked surfaces (7 groups)

The user specifically requested these in the register. **Do not silently remove safety gates or switch on providers.**

| Group | Screen / labels | Current behavior | Suggested wire/remove decision | Evidence / verification |
|---|---|---|---|---|
| U01 | Public paid event **Pay amount and RSVP**; paid offer **Join/Buy** | Uses legacy payment/service paths, not the newly enabled plan/license purchase flow. Disconnected requests show **Payments are on the way / not connected**. | **Remove/disable paid event, challenge and offer entry points for current beta scope:** only plans/licenses were authorized. Keep free joins. Later wire separately if approved. | `src/components/guest-rsvp.tsx:109–112,131`; `src/components/offers.tsx:192–203,233–234`; billing server functions. Paid payment not attempted. |
| U02 | Plan/Seats **Upgrade / Buy / Manage billing / Update card / downgrade confirm / Set up payouts**; public pricing **Coming soon** | Plan/license checkout is connected in sandbox and test notice is visible; portal or unavailable paths can return errors/safe-mode sheets. Payout setup remains separate legacy integration. Public marketing's non-free choices are disabled Coming soon when its readiness says disconnected, even while signed-in test upgrades are enabled. | **Wire** consistent readiness messaging for authorized plans/licenses and complete purchase verification; **remove** payout selling prompts from current plans/licenses-only beta. Keep test-mode disclosure. | `plan-page.tsx:52–82,136–140,150,163,180–241`; `src/components/landing/marketing-pages.tsx:56`. Last-turn payment reached Processing with no recorded purchase: still unverified, not retried here. |
| U03 | Events **Map** when selector available; Team **Team map / Near me**; create/edit **map search**; public location **Map** | Missing map connection yields a preview/static placeholder or typed-address fallback. Public location says **Interactive map coming soon**; Get directions is a separate external link. Events' map selector is not the same as the gated Team Map route. | **Remove/disable misleading interactive-map entrance** until available; keep list, typed address and directions usable. | `events-page.tsx:50–54`; `src/components/map-page.tsx:26–45,85–105`; `src/components/locations.tsx:196–198`; Team Map and public location fallback visibly checked both sizes. |
| U04 | Learn **Join**, **Translate**, **Remind me** | Live Join only appears when session is open with a real link; otherwise link-soon note. Translation can be preview/not-connected; reminders may be saved but delivery is unavailable. Learn is parked for non-admins. | **Remove parked entry points** for beta; later **wire** required links/delivery with truthful status. Do not count absent Join before start as a dead button. | `src/components/learn.tsx:84–107`; `learn-manage.tsx:34–35`. No real tracks/lessons exist, so live session not executed. |
| U05 | Assistant, morning brief, follow success, notification channels | Assistant/brief explicitly display preview mode; email/text channels visibly say Not connected yet. Public Follow success promises email despite delivery being service-dependent. | Keep preview disclosures; **wire** Follow success to say preference saved, with delivery availability. Hide preview features if not part of approved beta. | `src/components/follow.tsx:89–94`; `src/lib/notify/process.server.ts:19,29,44,61,95`; `src/components/notifications.tsx:26–37,83–103`; `assistant-panel.tsx:42–46`. Admin Mail visibly reports email/text simulated, push live. |
| U06 | Team → **Your liability waiver → Edit waiver** | Editor initializes only from an existing waiver. Missing row or query failure can leave Loading forever without creation/retry. | **Wire** empty/error/retry handling; create only when allowed, otherwise explain recovery. | `src/components/waiver.tsx:64–75`; missing-row condition not reproduced. |
| U07 | Admin → Founding coaches **Invite**; documented **/admin?tab=flags** | Invite adds/audits a coach row, not an outbound invitation. Invalid `flags` tab resolves to Overview; actual switches are under Settings. | **Wire** an actual invitation with truthful safe-mode status or rename Add coach. **Wire** flag deep links to `/admin?tab=settings` or support alias. | `founding.tsx:88,106–110`; `admin.functions.ts:467–475`; `src/routes/_authenticated/_app/admin.index.tsx:7`; `admin-console.tsx:24,424–439`; `src/lib/feature-flags.tsx:8`. |

### Live parked-feature register

| Off flag | Surfaces examined | Current behavior | Recommendation |
|---|---|---|---|
| `feature_learn` | Learn, manage, tracks, lessons, recipes; Training Create option | Non-admin gated routes return not-found; shell entry hidden. Admin can browse; Training hidden in the observed Create state. | Keep ordinary entrances removed until Resources scope approved. Align related Create/recognition prompts later. |
| `feature_network` | Home Explore your network; event network sharing; `/network` | Gated entry/route; admin override exposes an empty but real network page. | Keep ordinary entrances removed. Admin visibility is not a consumer dead click. |
| `feature_retreats` | Event form retreat/trip tools | Admin can see tools; off for ordinary users. | Keep parked; do not expose paid retreat paths in beta. |
| `feature_badges_limited` | Limited badge collections, related recognition/personal-best presentation | Flag-controlled areas available to admin; base recognition remains. | Keep limited feature parked; retain working base awards. |
| `feature_playbook` | Recommendations/Playbook on Home and Insights | Off for non-admins; sample recommendations suppressed. | Keep removed from beta until requested. |
| `feature_team_map` | Team and Home Team map; `/team/map` | Matching entry/route gate, admin override shows disconnected map preview. | Keep ordinary entrances removed; retain useful event lists. |

Generic Sample/Coming soon sheets still exist in `gatherwell-shell.tsx:76–78`, but **no reachable current primary caller was established** for their placeholder branches. Dormant scaffolding is not counted as a live defect.

## Coverage — every content-route pattern

**B** = opened on phone + desktop. **E** = explicit missing/invalid/empty state checked, not populated success. **S** = source inspected only. Dynamic examples are representative; not every record or state.

### Public (22)

| Pattern | Coverage |
|---|---|
| `/`, `/hosts`, `/pricing`, `/discover`, `/studios`, `/credits` | B: primary pages, visible links/controls, shared navigation. Discover RSVP destination and form opening checked. |
| `/login`, `/admin-login` | B: signed-out forms. No login email requested, password changed or OAuth flow executed. |
| `/terms`, `/privacy`, `/legal/$doc` | B: sms, host, guest, cookies documents. Legal links exist; legal review remains outside this audit. |
| `/e/$id` | B: real public event and invalid ID; guest RSVP form opened but not submitted. |
| `/h/$slug`, `/t/$slug`, `/l/$slug` | B: real host/team/location and invalid slugs; no follow writes. |
| `/i/$code`, `/join/$code`, `/r/$code`, `/unsubscribe/$token` | B/E: invalid-code/token behavior; valid workflows S. No real private RSVP-management or email-preference token used. |

### Signed-in (37)

| Pattern | Coverage |
|---|---|
| `/onboarding` | B: existing onboarded user redirects to Home. New-user/join completion S; no account reset. |
| `/home`, `/events`, `/team`, `/me` | B: real signed-in admin/team state, menus, shortcuts, empty events, Me sheets. |
| `/gathering/new`, `/gathering/$id/edit` | B: quick creation/full edit controls; no publish/save. Edit used another host's event to inspect visible access only; authorization on save untested. |
| `/event/$id`, `/event/$id/guests`, `/event/$id/checkin` | B: real event owned by another host; controls/permission mismatch documented. No guest added/exported/scanned/checked in. |
| `/challenge/$id` | B/E: existing challenge outside account's visible scope showed retry/unavailable; permitted populated state S. This alone is not a dead link. |
| `/learn`, `/learn/manage`, `/learn/recipes`, `/learn/recipe/$id` | B: admin override, empty tracks, real recipe list/detail. Save, upload, translation and completion S only. |
| `/learn/track/$id`, `/learn/lesson/$id` | B/E: missing ID state; no populated fixture exists. S: links/editors/completion/live branches. |
| `/network`, `/team/map`, `/team/insights` | B: admin override, empty network/map, real team metrics. Metrics/actions source inspected; no shoutout. |
| `/progress`, `/followups`, `/start` | B: empty/private progress, empty inbox, quick-start creation screen. No progress, draft, payout or publishing changes. |
| `/offers`, `/offer/$id`, `/circles`, `/locations` | B: list/detail/editor entry presentation and empty states; no joining/purchase/creation. External booking/store destination handling S. |
| `/plan`, `/plan/seats`, `/earnings`, `/promos`, `/verify` | B: real Free account, sandbox upgrade/license entry labels, seats/payout/verification forms. Billing operations and paid purchase deliberately not executed. |
| `/admin`, `/admin/site-media` | B: all 12 Admin tabs selected at both sizes; media page opened. No retry/broadcast/simulation/role/moderation/settings/founding/response/media write. |

### Nested surfaces and action chains inspected in source

- Shared shell/Create/Assistant; Home briefs/checklist/templates; Events list/calendar/map; Team switcher/member sheets/announcement/subteams/challenges/blueprints/invite/recognition/waivers.
- Me profile/photos/teams/events/challenges/badges/purchases/invites/calendar/notifications/appearance/support/account deletion.
- Event management/cohosts/comments/questions/waivers/checklist/polls/photos/share-kit/promos/retreat/refunds; free and paid guest/team RSVP, RSVP management.
- Learn tracks/lessons/recipes/editors/live links/reminders; Network/Map/Insights/Playbook; Progress/Welcome rewards/Offers/Locations/coach launch/reviews/verification.
- Admin Overview, Teams, People, Moderation, Verify, Global library, Broadcasts, Founding coaches, Day 60, Settings, Audit log, Mail; separate site-media.
- Public marketing/header/footer/categories/filtering/sample cards/follow/calendar/directions/auth/legal links.

No additional unconditional absent handler was established for recognition, conversations, location editing, coach reviews/verification, onboarding continuation or site-media actions. **This does not certify their mutation outcomes.**

Non-content routes also inventoried: shared root/auth/app layouts, sitemap, calendar feed, AI follow-up endpoint, message processor/provider callbacks and both payment webhook endpoints. They have no page buttons and were not invoked.

## Other observed signals (not counted as dead clicks)

1. Discover produced a hydration mismatch on both sizes; it subsequently rendered and RSVP navigation worked. Relevant area: `src/components/landing/discover-page.tsx:51`, server empty text versus client loading skeleton. Investigate separately; do not imply the final controls were blank.
2. A published event titled **Sunset walk (test delete)** remains discoverable. No event was changed because this step is report-only.
3. Insights has an unlabeled fabricated follow-up fallback (`14` versus `9`) when its real-data predicate is false (`src/components/insights-page.tsx:78–90`). The tested account showed real `0`. Data integrity finding, not a click defect.
4. Learn recipes' **All events** label navigates correctly to `/learn/recipes` (`learn.tsx:143`, reused `home.viewAll` copy). Misleading label, not a wrong destination; change to All recipes in a later copy pass.
5. Marketing/quick-start still advertise some bilingual or paid-customer features despite current English-only/plans-and-licenses-only scope. No copy or selling paths changed.

## Evidence and limits

Browser records: `/tmp/browser/dead-clicks/pages.json`, `details.json`, `actions.json`, `public-flow.json`; viewport screenshots under `/tmp/browser/dead-clicks/screenshots/`. They are sandbox diagnostics, not user-facing downloadable files.

**Not claimed:** every individual button was executed; every dynamic record/status tested; ordinary-member/host/cohost/leader role matrix verified; valid invite/RSVP/email-token flows completed; account creation, real delivery, payment, role changes, deletion, publishing or check-in tested. Read-only audit intentionally avoids those writes. Native sharing, clipboard denial, camera permission, downloads, installed mail/calendar clients and external site availability are source-only.

Every route pattern was inventoried and source-reviewed, but large multi-file reviews cannot certify every nested branch defect-free. A complete transactional end-to-end beta test remains separate work. No tests were added or run because no application behavior changed.
