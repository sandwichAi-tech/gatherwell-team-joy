> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# Gatherwell — D1 Premium Design Audit

**Date:** 6 October 2026 · **Deliverable:** Step 1, report before fixes · **Status:** audit complete; no visual implementation performed.

## Executive verdict

**Needs work.** The existing palette, navigation, bilingual resources, safe-area rules and shared icon registry provide a useful foundation. They do not yet form a consistent premium surface system. The biggest visible weaknesses are Me's long undifferentiated settings list, the member-detail sheet's sparse administrative layout, canvas-colored desktop dialogs, generic confirmations, and inconsistent feature tiles and action icons.

### Priority findings

1. **P0 — broken token references:** `src/styles.css:1136–1214` uses `--radius`, `--accent`, `--accent-foreground`, `--ring` without defining them. This invalidates radius/background/focus declarations in Offers, Welcome rewards, Playbook, waivers, RSVP-question editors and conversation focus treatment. Tailwind mappings such as `--color-ring` do **not** define `--ring`.
2. **P1 — Me / member profile:** Me is one long settings list containing personal activity, preferences, administration, support and legal links. Recognition is three zero-value bordered boxes inside another panel. Member detail shows initials, role and a custom-badge input; it has no identity-led profile composition or contextual activity summary. See screenshots and `me-page.tsx:160–228`, `team-page.tsx:332–355`.
3. **P1 — surface separation:** `.panel` has only the original tiny shadow; `DialogContent` and `SheetContent` use `bg-background` rather than the card surface, while mobile drawers use the card surface. This is visible in the member and empty-gatherings dialogs. Layering is not consistently conveyed by an elevated surface.
4. **P1 — native confirmations:** challenge deletion; offer deletion/cancellation; track, lesson and recipe deletion; comment/topic deletion use browser-owned `window.confirm`. They cannot follow the app's visual theme, layout or motion.
5. **P1 — icon hierarchy:** Button's `[&_svg]:size-4` forces 16px action icons; dialog/sheet close icons also force 16px. Feature representations use 32/40/44/56/72px containers, letters or bare icons instead of one documented feature-tile family.
6. **P1 — incomplete states:** several screens show bare loading text, null or empty-div fallbacks; numerous empty sheets are only title plus sentence. “My gatherings” and “My challenges” are static placeholder bodies, not refined personal activity experiences.
7. **P2 — spacing/type drift:** newer styles use 9.6/10/14/14.4px gaps/padding and undefined radii; dashboard metadata frequently uses 10–12px text. A strict 8px grid and consistent type roles are not enforced.
8. **P2 — motion drift:** desktop Sheet declares 500ms opening / 300ms closing, against the 150–200ms rule. Global reduced-motion handling **does exist**. Success feedback ranges from inline “Copied” to generic Sonner notifications; there is no coherent success transition specification.
9. **P2 — bilingual/mobile details:** resource key sets match, but hardcoded admin icon names and license labels remain. Me's English ES control measures about 43px wide. Spanish recognition/assistant labels become multi-line; the floating create control overlays readable content on the initial Me viewport.
10. **P2 — public visual drift:** landing CSS defines Inter Tight plus Instrument Serif, deeper multi-layer shadows, and circular category treatments, despite DESIGN_RULES.md's Inter / subtle-shadow / feature-tile requirements. This is existing drift, not a proposed change.

## Method, scoring and limits

Inventory covers **40 content route files**, their named screen variants, every source-found feature overlay and native confirmation, actual menu/selector families, and every `toast.*` call site. API routes, sitemap/robots/manifest, and layout-only routes are not visual screens. Shared shell, public frame, 404, error and loading states are included separately.

Each row has an overall **Pass / Needs work**. Checklist letters: **H** hierarchy; **D** depth/layering; **I** icons/feature tiles; **S** 8px spacing; **T** typography; **C** content/empty states; **M** open/close/success motion; **A** mobile targets/safe areas; **L** light/dark; **B** English/Spanish fit. “Needs” lists the criteria requiring work. A dash means no item-specific defect established in source; it is not an exhaustive browser certification. Non-applicable items (e.g. open/close motion on a legal document) do not lower a score.

**Evidence labels:** V = inspected live preview; S = inspected source. Source-only populated/paid/second-person states are not described as visually verified. No new events, members, purchases, posts or provider connections were created. No two-account journey was attempted, per the earlier instruction.

**Browser checks:** authenticated Me and edit-profile at 375, 414 and 1440px, English/Spanish, light/dark (12 combinations); main screens at 1280px; member detail, Create, Assistant, My gatherings empty dialog, team invite and inline Copied feedback. Me had no horizontal document overflow in the measured combinations. Public initial signed-out screens were also captured. Initial loading screenshots were replaced with loaded screenshots for focused Me checks. Browser errors were absent in the recorded main-screen run. Full light/dark/EN/ES certification of every populated route is still unperformed.

**Do not misdiagnose:** dark colors generally inherit valid semantic variables; lack of a `.dark .some-component` selector alone is not a failure. Escape handling exists in the custom landing menu, but a focus trap/return is not implemented there. Sonner is mounted once, explicitly **top-center**. Global reduced-motion rules exist at `styles.css:50,1114`. The invite screenshot shows inline “Copied”, **not** a toast. Some source inventories include unused UI primitives; those are not active screens.

### Design-rule conflict to resolve during Step 2

The new brief requires elevation rather than border-only separation, but DESIGN_RULES.md:18 caps white-card shadow at `0 1px 2px rgba(28,23,38,.04)`. D1 records the weakness without silently replacing that permanent rule. A future foundation revision should explicitly define permitted elevation for cards, menus, dialogs, drawers and toasts, preserving the palette, bilingual coverage and no-emoji rule. Do not introduce gradients, serif typography or extra decorative marks as a shortcut.

## 1. Screen inventory

All app detail URLs below are real public URL paths; underscores in file route names are routing syntax, not URL segments.

| Screen / URL | Evidence / source | Score | Needs | Specific problem |
|---|---|---|---|---|
| Landing `/` | V/S · landing/landing-page.tsx; styles.css:666–886 | Needs work | D,I,T | Inter Tight/serif and deeper shadow drift; circular category tiles; client-only frame can initially be empty. |
| Discover `/discover` | V/S · landing/discover-page.tsx | Needs work | I,C | Category treatment diverges from feature tiles; filtered empty message has no clear-filter action. |
| Sign in `/login` | V/S · routes/login.tsx; auth-frame.tsx | Pass | — | Clear primary email action and alternate sign-in; semantic surfaces and localized copy. Public checks only, no sign-in submission audited. |
| Onboarding `/onboarding` — role/profile/team steps | S · routes/_authenticated/onboarding.tsx | Needs work | I,C | 44px role-icon tiles differ from feature system; initial saving state is plain text. |
| Team invite `/join/$code` | S · routes/join.$code.tsx | Needs work | C | Initial loading is a bare subtitle rather than a composed invite-loading state. |
| Friend invite `/i/$code` | S · routes/i.$code.tsx | Needs work | H,C | Immediate redirect has only loading text, weak branded context if navigation stalls. |
| Guest gathering `/e/$id` | S · routes/e.$id.tsx; guest-rsvp.tsx | Needs work | S,I | Waiver/cohost/question blocks inherit fractional spacing and unresolved radius tokens; populated event not browser-checked. |
| Manage RSVP `/r/$code` | S · routes/r.$code.tsx | Needs work | C | Loading and unavailable states use centered plain text; cancellation itself uses a themed sheet. |
| Terms `/terms` | S · auth-frame.tsx; routes/terms.tsx | Pass | — | Readable structured legal document; draft status explicit. Legal approval is outside the visual audit. |
| Privacy `/privacy` | S · auth-frame.tsx; routes/privacy.tsx | Pass | — | Shared structured legal layout; final content approval still external. |
| Other legal `/legal/$doc` — host/guest/SMS/cookies | S · auth-frame.tsx:47–58 | Pass | — | Distinct documents share legible hierarchy, legal links and explicit draft status. |
| Photo credits `/credits` | S · routes/credits.tsx | Needs work | C | Empty media results leave an empty list without an explanatory state. |
| Email preferences `/unsubscribe/$token` | S · routes/unsubscribe.$token.tsx | Pass | — | Loading, invalid, saved and channel settings have distinct localized copy. |
| Home `/home` | V/S · gatherwell-pages.tsx; styles.css:37–44 | Needs work | D,I,T,C | Small metadata and feature-container drift; sample September dates are stale relative to audit date; future-looking sample label must remain truthful. |
| Gatherings `/events` | V/S · events-page.tsx | Needs work | H,C | Live “create first” state and sample calendar coexist; content hierarchy should separate real emptiness from sample examples. |
| Gathering detail `/event/$id` | S · routes/_authenticated/_app/event.$id.tsx | Needs work | H,D,C | Many similar-weight management actions; bare loading panel; newer embedded editors inherit unresolved tokens. |
| New gathering `/gathering/new` | S · gathering-form.tsx | Needs work | C,S | Workspace-loading path returns null; category/create controls and newer Playbook spacing differ from foundation. |
| Edit gathering `/gathering/$id/edit` | S · gathering-form.tsx | Needs work | C,S | Same blank workspace-loading path and dense mixed-control layout; long bilingual text not live tested. |
| Guest list `/event/$id/guests` — going/maybe/waitlist/requests/declined/cancelled | S · event_.$id.guests.tsx | Needs work | C,T | Loading/access-denied/empty-tab treatment is plain text; answer/waiver metadata uses small varying type sizes. |
| Check-in `/event/$id/checkin` — list/scanner/walk-ins | S · event_.$id.checkin.tsx | Pass | — | Shared skeleton/retry, offline queue states, safe-area scanner and result feedback provide a strong functional foundation; populated visual certification pending. |
| Team `/team` | V/S · team-page.tsx | Needs work | H,D,I,C | Long sequence of same-weight panels; empty group-chat panel is mostly one action; cover is a monogram gradient; leader tools lack consistent feature tiles. |
| Insights `/team/insights` | S · insights-page.tsx; playbook.tsx | Needs work | D,I,S | Panel-heavy composition; Playbook icon refers to undefined accent vars and nonstandard 32px circle; fractional benchmark spacing. |
| Team map `/team/map` | S · map-page.tsx | Needs work | C | Events default to empty array without distinct initial query loading; missing-provider placeholder is explicit, not a grey box. |
| Network `/network` | V/S · network-page.tsx | Needs work | C,D | Three empty text-led sections feel underfilled with one account; source has shared loading/retry but empty composition lacks visual weight. |
| Learn `/learn` | V/S · learn.tsx | Needs work | I,C | Sample track monograms instead of coherent feature visuals; samples are correctly labeled, but cover treatment is basic. |
| Track `/learn/track/$id` | S · learn.tsx | Needs work | C,I | Not-found is text/back link; monogram cover and completion styling need coherent feature hierarchy. |
| Lesson `/learn/lesson/$id` | S · learn.tsx | Needs work | C | Missing/unavailable player uses plain text rather than composed player-state treatment; skeleton/retry otherwise shared. |
| Recipes `/learn/recipes` | S · learn.tsx | Needs work | I,C | Recipe/list visual language and empty treatment must align with track/detail states; source-only populated review. |
| Recipe `/learn/recipe/$id` | S · learn.tsx | Needs work | C | Missing data returns bare min-h-96 div instead of a labeled loading/not-found state. |
| Manage Learn `/learn/manage` — tracks/lessons/recipes | S · learn-manage.tsx | Needs work | D,M,L | Native delete confirmations break premium/themed overlay consistency; editors inherit shared dialog surface issues. |
| Challenge `/challenge/$id` | S · challenges.tsx | Needs work | D,M,L | Editor delete uses native confirm; create/check-in/cheer surfaces need shared elevation and motion. |
| Me `/me` | V/S · me-page.tsx:160–228 | Needs work | H,D,I,C,A,B | One large ungrouped list; nested zero stats; empty personal panels; ES control ~43px wide; long Spanish labels and floating + compete with content. |
| Offers `/offers` | V/S · offers.tsx | Needs work | D,I,C,S | Bare FileText empty/permission state; covers reference undefined radius; native deletion confirmation. |
| Offer `/offer/$id` | S · offers.tsx | Needs work | D,I,S | Undefined cover radius; bare lock/not-found state; customer action and ownership states need shared surface treatment. |
| Plan `/plan` | V/S · plan-page.tsx | Needs work | H,C,D | Plain loading text; multiple plans/licenses/payout actions need clearer grouping; layered billing sheets inherit generic dialog treatment. |
| Seats `/plan/seats` | S · plan-page.tsx | Pass | — | No-license branch has real copy and CTA; rows disable while busy; populated target/language fit not live checked. |
| Earnings `/earnings` | S · plan-page.tsx | Needs work | H,C,S | Zero payment metrics lack context; rewards inherit undefined radii. Separately reconcile money/earnings displays with PROJECT_RULES activity-only restriction; no behavior changed here. |
| Follow-ups `/followups` | S · smart.tsx | Needs work | C,D | Empty inbox is one text-led panel; composed loading/retry exists, but preview and send-result treatments should share status hierarchy. |
| Admin `/admin` — overview/teams/people/moderation/library/broadcasts/settings/audit | V/S · admin-console.tsx | Needs work | H,C,A,B | Eight horizontal tabs; plain inner-loading/empty rows; dense nowrap tables; hardcoded license/icon labels bypass localization. |
| Site media `/admin/site-media` | S · site-media-admin.tsx | Needs work | C,D | Plain loading text; image editor inherits generic long-form popup. Access-denied feature tile is a good reusable baseline. |

### Shared layouts and global states

| Surface | Score | Needs | Evidence / problem |
|---|---|---|---|
| App shell / desktop sidebar / mobile tabs | Needs work | H,C,A | `gatherwell-shell.tsx`: persistent Sample labels/note surround live team/profile data; “member view” is only a sample detail dialog, not a distinct role presentation. Floating + overlaps readable Me content; safe-area bottom padding already exists. |
| Public LandingFrame / GuestShell / AuthFrame | Needs work | C | LandingFrame has empty client-only fallback; GuestShell uses a skeleton; multiple public entry states have inconsistent loading compositions. |
| Global ListSkeleton | Pass | — | `launch-states.tsx`; branded 3-row skeleton reused widely; not every page-specific query adopts it. |
| Global RetryState / QueryFeedback | Pass | — | Friendly retry and slow-loading feedback; semantic tokens; sometimes displayed alongside already-rendered screen content. |
| Global 404 | Pass | — | `__root.tsx`, `styles.css:1101–1103`: dedicated branded missing page, large numeral, clear return action. |
| Global route error screen | Pass | — | Shared error handling/RetryState; no intentional blank failure screen. |
| Permission-denied states | Needs work | C,I | Admin/site-media use icon+heading+CTA; Offers/guest-list often use only text; no consistent permission-state design. |
| Not-connected / simulated statuses | Needs work | H,D | Clear truthful labels exist, but chip/text/panel/sheet variants have no unified status hierarchy. |

## 2. Dialog, bottom-sheet, side-panel and confirmation inventory

**Shared inheritance:** every `ResponsiveSheet` desktop instance uses `DialogContent`'s canvas-colored surface plus generic shadow; mobile instances use a card-colored drawer. Therefore every otherwise sound instance below still needs **D** foundation work. Text-only headers are not automatically wrong: feature tiles are required when representing a feature/category, not on every utility form. No new workflow (search, autosave, unsaved guard) is required by this visual audit.

| Surface / named state | Source | Score | Needs | Specific problem |
|---|---|---|---|---|
| Create picker | `gatherwell-shell.tsx:71–74` | Needs work | D,I,S | Desktop remains bottom drawer; 44px light icon tiles rather than feature tiles; four equal options need intentional spacing. |
| Shell announcement / challenge / training placeholders | `gatherwell-shell.tsx:73` | Needs work | D,C | Sample chip and coming-soon paragraph only; not a refined feature state. |
| Shell member-view / stat detail / follow-up / sample manage details | `gatherwell-shell.tsx:49–73` | Needs work | H,D,C | Generic profile sheet re-used for unrelated details; no action-led differentiated composition. |
| Assistant — mobile drawer / desktop right panel | `assistant/assistant-panel.tsx:88–99` | Needs work | D,M,I | 500/300ms Sheet defaults, 16px button icons; large idle panel with small prompt area; visible custom header exists despite sr-only primitive title. |
| Edit profile | `me-page.tsx:97–120` | Needs work | D,S | Two upload controls wrap unevenly on phone; desktop/mobile surface mismatch; Save remains in scrolling content. |
| Me: My gatherings empty | `me-page.tsx:163,217` | Needs work | D,C | Confirmed live title + one sentence only. |
| Me: My challenges empty | `me-page.tsx:164,217` | Needs work | D,C | Static title + paragraph only. |
| Me: My badges / badge wall | `me-page.tsx:165,217; recognition.tsx` | Needs work | D,C | Zero/empty badge state lacks consistent earned-vs-empty hierarchy. |
| Me: My teams picker | `me-page.tsx:166,217` | Needs work | D | Generic choice cards inside generic dialog; shared elevation issue. |
| Me: Notifications settings | `me-page.tsx:167,217; notifications.tsx` | Needs work | D | Same generic sheet title/body treatment despite longer preference groups. |
| Me: Invite friends / Welcome rewards | `me-page.tsx:168,217; welcome.tsx` | Needs work | D,S | Undefined radius in stat/reward containers; 10/14px spacing drift. |
| Me: Purchases / cancel membership | `me-page.tsx:169,217; offers.tsx:207–222` | Needs work | D,C,M,L | Empty is bare paragraph; cancel confirmation is native browser UI. |
| Me: legacy plan panel (declared, no current visible trigger) | `me-page.tsx:170` | Needs work | D,C | Name plus workspace paragraph only; distinguish dormant state from active Plan route. |
| Delete account — checking / sole-leader blocked / type DELETE | `me-page.tsx:218–228` | Needs work | H,D,C | Danger state shares benign form treatment; checking is plain text; destructive CTA exists but header does not convey severity. |
| Team invite — share / reset-code inline confirm | `team-page.tsx:257–268` | Needs work | D,H | Link, channels and reset action in one body; reset confirmation has no distinct visual severity layer. |
| Team invite QR fullscreen | `team-page.tsx:269–275` | Needs work | I | Full-bleed QR is intentional; shared close icon is 16px. No defect merely because fullscreen has no card radius. |
| Edit team | `team-page.tsx:300–312` | Needs work | D | Shared generic dialog surface and no standardized long-form section rhythm. |
| Members list / member detail | `team-page.tsx:332–355` | Needs work | H,D,C | Confirmed live member detail is initials+role+badge input, primarily administrative, sparse for a member profile. |
| Member remove / leadership transfer inline confirmations | `team-page.tsx:346–354` | Needs work | H,D | Inline state swap inside detail sheet; danger hierarchy not standardized. |
| Announcement compose | `team-page.tsx:377–392` | Needs work | D | Same undifferentiated long-form sheet foundation. |
| Sub-team settings / creation tools | `team-page.tsx:150; SubTeamSettings` | Needs work | D | Generic sheet/inline form hierarchy; source-only populated state. |
| Cohost picker | `cohosts.tsx:47` | Needs work | D,C | Plain list/empty copy; feature purpose and selected/max states need visual hierarchy, not new functionality. |
| Report content | `report-button.tsx:32` | Needs work | D | Good localized reason controls; inherits canvas-colored desktop dialog. |
| Waiver editor | `waiver.tsx:73–83` | Needs work | D,S | Long bilingual form; unresolved radius tokens in associated waiver blocks and fractional spacing. |
| Template launch / preview | `templates.tsx:76` | Needs work | D | Feature preview and confirm use generic surface; consistent elevation missing. |
| Template create / edit | `templates.tsx:126` | Needs work | D | Long bilingual editor inherits shared surface and field hierarchy. |
| Badge earned | `recognition.tsx:113` | Needs work | D,M | Recognition uses medallions; celebratory success transition not unified with other success surfaces (no confetti needed). |
| Give shout-out | `recognition.tsx:197` | Needs work | D | Generic sheet; picker/message hierarchy needs shared foundation. |
| Host of the Month selection | `recognition.tsx:236` | Needs work | D | Same generic selection sheet. |
| Award badge | `recognition.tsx:256` | Needs work | D | Same generic selection sheet; feature tiles/medallions should remain consistent. |
| New custom badge | `recognition.tsx:283` | Needs work | D | Generic bilingual creation form; no unique defect merely because separate component exists. |
| Challenge create / edit | `challenges.tsx:119` | Needs work | D | Generic long bilingual editor. |
| Challenge delete native confirm | `challenges.tsx:113` | Needs work | D,M,L | Browser-owned appearance and animation; app-provided message can be translated, browser chrome cannot. |
| Challenge check-in / today / yesterday | `challenges.tsx:186` | Needs work | D | Generic form foundation; busy/success copy exists. |
| Challenge cheer | `challenges.tsx:208` | Needs work | D | Same foundation; reaction/cheer should remain icon-based. |
| Offer create / edit | `offers.tsx:103` | Needs work | D,S | Undefined cover radius and non-grid row spacing; generic editor. |
| Offer delete native confirm | `offers.tsx:96` | Needs work | D,M,L | Browser-owned unthemed confirmation. |
| Offer membership cancel native confirm | `offers.tsx:222` | Needs work | D,M,L | Browser-owned unthemed confirmation above purchase sheet. |
| Insights shout-out | `insights-page.tsx:121` | Needs work | D | Standard form, but generic elevation and footer pattern. |
| Insights personal check-in nudge | `insights-page.tsx:125` | Needs work | D | Prewritten message and send controls need shared header/footer hierarchy; not auto-sent. |
| Learn track create / edit | `learn-manage.tsx:67` | Needs work | D | Long bilingual generic editor. |
| Learn track delete native confirm | `learn-manage.tsx:62` | Needs work | D,M,L | Browser-owned unthemed confirmation. |
| Lesson create / edit | `learn-manage.tsx:128` | Needs work | D | Mixed upload/link/content editor needs shared sectional hierarchy. |
| Lesson delete native confirm | `learn-manage.tsx:122` | Needs work | D,M,L | Browser-owned unthemed confirmation. |
| Recipe create / edit | `learn-manage.tsx:218` | Needs work | D | Long content editor inherits generic surface. |
| Recipe delete native confirm | `learn-manage.tsx:212` | Needs work | D,M,L | Browser-owned unthemed confirmation. |
| Site-media slot / image editor | `site-media-admin.tsx:98` | Needs work | D | Photo/alt/credit/focal controls need intentional tool layout on shared elevated surface. |
| Mention picker | `conversation.tsx:61` | Needs work | D,S | Generic list sheet; conversation styling uses 10/14px spacing rather than grid. |
| Comment delete native confirm | `conversation.tsx:86` | Needs work | D,M,L | Browser UI breaks conversational visual continuity. |
| New discussion topic | `conversation.tsx:156` | Needs work | D | Standard editor inherits generic elevation. |
| Discussion topic / reply thread | `conversation.tsx:163` | Needs work | D,S | Nested reply indentation plus fractional spacing is dense on small screens. |
| Topic delete native confirm | `conversation.tsx:165` | Needs work | D,M,L | Native confirmation layered above themed discussion sheet. |
| Guest RSVP — going / maybe / requested / paid / waiver / custom questions | `guest-rsvp.tsx:106–126` | Needs work | D,S | One shared multi-state form; waiver/question containers inherit unresolved radii and fractional spacing. |
| Guest cancel RSVP | `routes/r.$code.tsx:61–63` | Needs work | D | Themed confirm is preferable to native; still generic desktop surface. |
| Payment not-connected sheet | `plan-page.tsx:24` | Needs work | D,C | Plain status composition needs a polished, truthful system status treatment. |
| Upgrade / limit sheet | `plan-page.tsx:52` | Needs work | D | Generic plan/limit popup inherits surface mismatch. |
| Downgrade confirmation | `plan-page.tsx:164` | Needs work | D,H | Same appearance as informational plan sheet; severity/consequence grouping needs definition. |
| Refund confirmation | `plan-page.tsx:273` | Needs work | D,H | Risk/amount/action hierarchy needs standardized confirmation treatment. |
| Gathering share — link / channels / network / members-only | `event.$id.tsx:151` | Needs work | D,H | Many sharing/settings concerns in one generic body; controls need grouped hierarchy. |
| Gathering cancel confirmation | `event.$id.tsx:162` | Needs work | D,H | Themed confirmation, but consequence/danger styling not unified. |
| Delete draft gathering | `event.$id.tsx:167` | Needs work | D,H | Themed confirmation inherits same benign header treatment. |
| Add guest manually | `event_.$id.guests.tsx:110` | Needs work | D | Generic form foundation; validation and busy labels present. |
| Walk-in / walk-in waiver | `event_.$id.checkin.tsx:182` | Needs work | D,S | Shared form surface plus waiver fractional spacing/unresolved radii. |
| Scanner fullscreen / permission / success / already checked in | `event_.$id.checkin.tsx; styles.css:509–511` | Pass | — | Pass: safe-area-aware full-screen functional tool with distinct result states; populated review pending. |
| Add poll | `event-live.tsx:112` | Needs work | D | Generic sheet; specific validation/vote states already localized. |
| Photo upload — file chooser | `event-live.tsx:141` | Pass | — | Pass: native OS file chooser is appropriate; not an app-styled modal. Upload result remains a toast. |
| Push permission rationale / system permission prompt | `notifications.tsx:60–68` | Needs work | D | Rationale is generic sheet; OS permission prompt is outside app styling, not a defect. |
| Admin team detail / suspend / plan / license controls | `admin-console.tsx:136–151` | Needs work | H,D,B | Multiple powerful actions share equal-weight form rows; hardcoded Team 25/100 labels. |
| Admin person detail / disable / delete / role | `admin-console.tsx:184–202` | Needs work | H,D | Powerful administrative actions need clear grouped danger hierarchy. |
| Admin library create / edit — template / recipe / badge | `admin-console.tsx:316–330` | Needs work | D,B | Native icon selector shows implementation names in English; long bilingual editor generic. |
| Admin broadcast compose / test / confirm | `admin-console.tsx:344–379` | Needs work | H,D | Confirmation is local inline state; no coherent high-impact action treatment. |
| Public mobile navigation menu | `landing-chrome.tsx:44–52` | Needs work | A,M | Custom role=dialog with Escape/body lock but no modal focus trap/return; conditional unmount prevents a proper exit transition. |

**Embedded side panels / framed tools (not separate modal portals):** RSVP settings/questions/private link (`rsvp-questions.tsx`) — Needs work S/D: 14px editor gaps/padding and undefined radius. Network referral thank-you controls (`network-share.tsx`) — Needs work H/D: inline sharing/payment-related controls need grouping. Welcome reward editor/honor codes (`welcome.tsx`) — Needs work S/D: unresolved radius and irregular gaps. Daily brief, follow-up inbox, lesson summary, claim guard and new-member plan (`smart.tsx`) — Needs work H/D where shown: status/preview/confirmation treatments vary; intentionally omitted no-data cards are not blank-screen failures. Assistant action-confirmation cards (`assistant-cards.tsx`) — Needs work D/I/M: action icons inherit Button's 16px sizing and success feedback is not foundation-standardized. Member plan and badge/completion cards — Needs work D/C: nested framed blocks and varied zero/completion treatments.

## 3. Menus, selectors and popovers

| Active surface | Source | Score | Needs | Problem |
|---|---|---|---|---|
| Workspace/team switch Select menu | team-switcher.tsx; ui/select.tsx | Needs work | D,I,T | Default menu shadow/14px type and 16px indicators; no Gatherwell menu-elevation variant. |
| Insights organization/sub-team Select | insights-page.tsx:98 | Needs work | D,I,T | Inherits same menu primitive; long team-name fit source-only. |
| Map scope/team Select | map-page.tsx | Needs work | D,I,T | Same primitive and popup placement styling. |
| Members-only offer native select | offers.tsx:271 | Needs work | D,L | Closed field themed; expanded OS menu styling differs by platform. |
| Admin plan / license native selects | admin-console.tsx:144,146 | Needs work | D,B | OS menu; hardcoded license labels. |
| Admin badge icon / tier selects | admin-console.tsx:323–324 | Needs work | I,B,D | Icon choices expose raw English icon names rather than symbols + localized accessible names; OS popup style. |
| Admin audience / headline / audit-area selectors | admin-console.tsx:353,386,400 | Needs work | D | Mixed native-selector treatment beside Radix selectors elsewhere. |
| Gathering/RSVP/challenge choice sets, filters and segmented controls | gathering-form.tsx; rsvp-questions.tsx; challenges.tsx; plan-page.tsx; Me | Needs work | I,S,A | Buttons/radio choices/toggles are appropriate, but sizing/spacing varies; Me ES width <44px in EN measured state. |
| Public category/date/location filters | landing-page.tsx; location-filter.tsx | Needs work | I,T | Category circle feature treatment and font system differ from app foundation. |
| Public mobile navigation | landing-chrome.tsx | Needs work | A,M | See overlay inventory: Escape works; focus trapping/return and exit motion missing. |
| Native date/time, color and file pickers | gathering-form, onboarding/profile/media editors | Pass | — | Platform-owned tools are appropriate; only app-owned trigger labels/targets need consistency checks. |
| Tooltip/title affordances | icon controls across shell/settings | Needs work | A,C | Native title attributes used in places; no consistent pointer/keyboard/touch tooltip treatment. Do not infer all icons need extra explanatory UI. |

**No live DropdownMenu, ContextMenu, Popover, HoverCard, Menubar, NavigationMenu or Command overlay was found outside UI definitions.** Their absence is not a missing-functionality defect. Unused primitive definitions remain a future consistency/cleanup concern, not active surfaces to redesign. `AlertDialog` likewise exists but actual destructive confirmations are sheets, inline state swaps or eight native confirmations.

## 4. Toast / transient notification audit

**All active app toasts: Needs work — D/I/M/A foundation.** `ui/sonner.tsx:5–19` uses `bg-background`, generic `shadow-lg`, no shared GwIcon success/error/loading mapping, and no app-defined status elevation/motion/safe-area policy. Root explicitly places it top-center. Semantic foreground/border tokens are already present. Success vs error have Sonner's built-in distinctions; they are not literally identical. Sonner's own default icons bypass the “all icons through GwIcon” requirement. No fake toast was injected for this audit; actual delivered visual toast stacks in every theme/language remain unverified.

Each source row below is individually scored **Needs work (D/I/M/A)** because it inherits that common presentation, not because its translated message is necessarily wrong. Each row records the exact call-site expression (dynamic keys retained) so distinct success/error/loading/message outcomes are not hidden by broad family labels. Inline “Copied” button feedback is separately inventoried above.

| Caller / line | Outcome / exact expression | Score | Needs |
|---|---|---|---|
| `src/components/admin-console.tsx:131` | error: `toast.error(errText(t, r.error)); else {` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:131` | success: `toast.success(t('admin.saved')); setNote(''); await qc.invalidateQueries({ queryKey: ['admin'] }); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:132` | error: `toast.error(t('admin.errors.failed')); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:179` | error: `toast.error(errText(t, r.error));` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:180` | success: `toast.success(t(action === 'resend' ? 'admin.users.linkSent' : 'admin.saved')); setNote(''); await qc.invalidateQueries({ queryKey: ['admin'] }); if (action === 'delete') onClose(); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:181` | error: `toast.error(t('admin.errors.failed')); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:226` | error: `toast.error(errText(t, res.error)); else {` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:226` | success: `toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin'] }); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:227` | error: `toast.error(t('admin.errors.failed')); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:309` | error: `toast.error(errText(t, r.error)); else {` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:309` | success: `toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'library'] }); onClose(); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:310` | error: `toast.error(t('admin.errors.failed')); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:344` | error: `toast.error(errText(t, r.error)); else {` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:344` | success: `toast.success(t(test ? 'admin.bc.testSent' : 'admin.bc.sent', { count: r.recipients })); setConfirm(false); if (!test) setF({ ...f, title_en: '', title_es: '', body_en: '', body_es: '' }); await qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] }); await qc.invalidateQueries({ queryKey: ['my-broadcast'] }); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:345` | error: `toast.error(t('admin.errors.failed')); }` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:379` | error: `toast.error(t('admin.errors.failed')); else {` | Needs work | D,I,M,A |
| `src/components/admin-console.tsx:379` | success: `toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); await qc.invalidateQueries({ queryKey: ['feature-flags'] }); }` | Needs work | D,I,M,A |
| `src/components/assistant/assistant-cards.tsx:18` | success: `toast.success(t('onboarding.copied')); };` | Needs work | D,I,M,A |
| `src/components/assistant/assistant-cards.tsx:32` | error: `toast.error(t('gathering.hostsOnlyText')); return; }` | Needs work | D,I,M,A |
| `src/components/assistant/assistant-cards.tsx:38` | error: `toast.error(rpcError(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/assistant/assistant-cards.tsx:80` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/assistant/assistant-cards.tsx:81` | success: `toast.success(t('assistant.recipeSaved'));` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:109` | error: `toast.error(t(rpcErrorKey(res.error))); return; }` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:110` | success: `toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['challenges'] }); onClose();` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:115` | error: `toast.error(t(rpcErrorKey(res.error))); return; }` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:134` | error: `toast.error(t('profile.saveError')); } }} /></label></div>` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:180` | success: `toast.success(t('challenges.checkedIn'), { description: t('challenges.streakShort', { count: r?.current ?? 1 }) });` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:183` | error: `toast.error(t(rpcErrorKey(e))); }` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:202` | error: `toast.error(t(rpcErrorKey(error))); return; }` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:203` | success: `toast.success(t('challenges.cheerSent')); setOpen(false); setMsg('');` | Needs work | D,I,M,A |
| `src/components/challenges.tsx:248` | error: `toast.error(t(rpcErrorKey(error))); return; }` | Needs work | D,I,M,A |
| `src/components/cohosts.tsx:37` | error: `toast.error(t(error.message.includes('too_many') ? 'cohosts.tooMany' : 'profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/cohosts.tsx:38` | success: `toast.success(t('cohosts.saved')); setOpen(false);` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:51` | error: `toast.error(t(errorKey(error))); return; }` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:72` | error: `toast.error(t(errorKey(error))); return; } if (ok)` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:72` | success: `toast.success(t(ok)); void refresh(); };` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:144` | error: `toast.error(t(errorKey(error))); return; }` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:148` | error: `toast.error(t(errorKey(error))); return; } if (args['_delete']) setOpen(null); void qc.invalidateQueries({ queryKey: key }); };` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:179` | error: `toast.error(t('conversation.badLink')); return; }` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:181` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/conversation.tsx:182` | success: `toast.success(t('conversation.linkSaved')); setEditing(false);` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:73` | error: `toast.error(t(error.message.includes('already_voted') ? 'live.alreadyVoted' : error.message.includes('poll_closed') ? 'live.pollClosed' : 'guest.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:107` | error: `toast.error(t('live.pollInvalid')); return; }` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:109` | error: `toast.error(t('guest.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:141` | error: `toast.error(t('live.photoErrors.${res.error}', { defaultValue: t('guest.errors.generic') }));` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:142` | success: `toast.success(t('live.photoAdded')); await queryClient.invalidateQueries({ queryKey: ['photos', eventId] }); }` | Needs work | D,I,M,A |
| `src/components/event-live.tsx:143` | error: `toast.error(t('guest.errors.generic')); }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:120` | error: `toast.error(t('gathering.fixFields')); return; }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:124` | error: `toast.error(rpcError(t, r.error)); return; } }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:126` | error: `toast.error(rpcError(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:128` | success: `toast.success(t('gathering.saved'));` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:134` | error: `toast.error(rpcError(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:137` | success: `toast.success(t('gathering.draftSaved')); void navigate({ to: '/event/$id', params: { id: data } }); }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:141` | error: `toast.error(t('gathering.photoTooBig')); return; }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:143` | error: `toast.error(t('profile.saveError')); } finally { setUploading(false); }` | Needs work | D,I,M,A |
| `src/components/gathering-form.tsx:157` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>` | Needs work | D,I,M,A |
| `src/components/guest-rsvp.tsx:42` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>` | Needs work | D,I,M,A |
| `src/components/insights-page.tsx:88` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/insights-page.tsx:89` | success: `toast.success(t('insights.shoutPosted')); setShout(null); await queryClient.invalidateQueries({ queryKey: [...teamKey(rootId), 'wins'] });` | Needs work | D,I,M,A |
| `src/components/insights-page.tsx:127` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('insights.copy')}</Button>` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:44` | error: `toast.error(errMsg(t, err)); } setBusy(false); }} /></label></div>;` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:58` | error: `toast.error(errMsg(t, res.error)); return; }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:59` | success: `toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose();` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:64` | error: `toast.error(errMsg(t, res.error)); return; }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:100` | error: `toast.error(errMsg(t, e)); setProgress(null); setFileName(''); }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:117` | success: `toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose();` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:118` | error: `toast.error(errMsg(t, e)); }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:124` | error: `toast.error(errMsg(t, r.error)); return; }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:163` | error: `toast.error(t('profile.saveError'));` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:208` | error: `toast.error(errMsg(t, res.error)); return; }` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:209` | success: `toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['recipes', userId] }); onClose();` | Needs work | D,I,M,A |
| `src/components/learn-manage.tsx:214` | error: `toast.error(errMsg(t, res.error)); return; }` | Needs work | D,I,M,A |
| `src/components/learn.tsx:103` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/learn.tsx:233` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/learn.tsx:281` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/learn.tsx:287` | success: `toast.success(t('next.copied'));` | Needs work | D,I,M,A |
| `src/components/map-page.tsx:75` | error: `toast.error(t('map.noLocation')); return; }` | Needs work | D,I,M,A |
| `src/components/map-page.tsx:76` | error: `toast.error(t('map.noLocation')), { timeout: 10000 });` | Needs work | D,I,M,A |
| `src/components/me-page.tsx:85` | success: `toast.success(t('profile.saved'));` | Needs work | D,I,M,A |
| `src/components/me-page.tsx:87` | error: `toast.error(t('profile.saveError')); }` | Needs work | D,I,M,A |
| `src/components/me-page.tsx:156` | error: `toast.error(error.message.includes('sole_leader') ? t('profile.deleteBlocked') : t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/network-page.tsx:30` | success: `toast.success(t(ok)); await qc.invalidateQueries({ queryKey: ['network'] }); await qc.invalidateQueries({ queryKey: ['network-featured'] }); }` | Needs work | D,I,M,A |
| `src/components/network-page.tsx:31` | error: `toast.error(t('network.error')); }` | Needs work | D,I,M,A |
| `src/components/network-page.tsx:48` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('network.copyGuestLink')}</Button>` | Needs work | D,I,M,A |
| `src/components/network-share.tsx:19` | success: `toast.success(t(v ? 'network.shared' : 'network.unshared')); await qc.invalidateQueries({ queryKey: ['network-shared', eventId] }); }` | Needs work | D,I,M,A |
| `src/components/network-share.tsx:20` | error: `toast.error(t('network.error')); }` | Needs work | D,I,M,A |
| `src/components/network-share.tsx:40` | error: `toast.error(t('network.thanksInvalid')); return; }` | Needs work | D,I,M,A |
| `src/components/network-share.tsx:41` | success: `toast.success(t('profile.saved')); await qc.invalidateQueries({ queryKey: ['referrals'] }); }` | Needs work | D,I,M,A |
| `src/components/network-share.tsx:42` | error: `toast.error(t('network.error')); }` | Needs work | D,I,M,A |
| `src/components/notifications.tsx:65` | success: `toast.success(t('notify.pushOn')); } catch {` | Needs work | D,I,M,A |
| `src/components/notifications.tsx:65` | error: `toast.error(t('profile.saveError')); } setBusy(false); setReason(null); }}><Bell />{t('notify.turnOn')}</Button>` | Needs work | D,I,M,A |
| `src/components/notifications.tsx:85` | error: `toast.error(t('profile.saveError'));` | Needs work | D,I,M,A |
| `src/components/notifications.tsx:97` | success: `toast.success(t('notify.pushOn')); } else if (r === 'denied') setDevice('blocked'); } catch {` | Needs work | D,I,M,A |
| `src/components/notifications.tsx:97` | error: `toast.error(t('profile.saveError')); } }}><Bell />{t('notify.enableDevice')}</Button>}` | Needs work | D,I,M,A |
| `src/components/offers.tsx:90` | error: `toast.error(t('offers.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:91` | success: `toast.success(t('templates.saved'));` | Needs work | D,I,M,A |
| `src/components/offers.tsx:98` | error: `toast.error(t('offers.deleteError')); return; }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:125` | error: `toast.error(t('offers.fileTooBig')); return; } setBusy(true); try { setF(v => ({ ...v, file_path: '' })); const p = await uploadOfferFile(userId, file); setF(v => ({ ...v, file_path: p }));` | Needs work | D,I,M,A |
| `src/components/offers.tsx:125` | success: `toast.success(t('offers.fileReady')); } catch {` | Needs work | D,I,M,A |
| `src/components/offers.tsx:125` | error: `toast.error(t('offers.uploadError')); setF(v => ({ ...v, file_path: null })); } setBusy(false); }} /></label>` | Needs work | D,I,M,A |
| `src/components/offers.tsx:156` | success: `toast.success(t(offer.kind === 'download' ? 'offers.unlocked' : 'offers.joined')); await qc.invalidateQueries({ queryKey: ['offers'] }); }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:160` | error: `toast.error(t('offers.errors.${r.error}', { defaultValue: t('offers.errors.generic') }));` | Needs work | D,I,M,A |
| `src/components/offers.tsx:162` | error: `toast.error(t('offers.errors.generic')); }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:169` | error: `toast.error(t('offers.errors.download'));` | Needs work | D,I,M,A |
| `src/components/offers.tsx:226` | error: `toast.error(t(r.error === 'not_connected' ? 'billing.notConnected' : 'offers.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:227` | success: `toast.success(t(r.ended ? 'offers.cancelled' : 'offers.cancelScheduled'));` | Needs work | D,I,M,A |
| `src/components/offers.tsx:230` | error: `toast.error(t('offers.errors.download')); };` | Needs work | D,I,M,A |
| `src/components/offers.tsx:266` | error: `toast.error(t('offers.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/components/offers.tsx:267` | success: `toast.success(t(v ? 'offers.nowMembersOnly' : 'offers.nowOpen'));` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:42` | error: `toast.error(t('billing.error'));` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:43` | error: `toast.error(t('billing.error')); }` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:99` | error: `toast.error(t('billing.error')); else void qc.invalidateQueries({ queryKey: ['plan-status'] });` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:205` | error: `toast.error(error.message.includes('seats_full') ? t('billing.seatsFull') : t('billing.error')); return; }` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:210` | error: `toast.error(t('billing.error')); else void qc.invalidateQueries({ queryKey: ['license', teamId] });` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:254` | success: `toast.success(t('billing.refunded', { count: r.refunded })); void qc.invalidateQueries({ queryKey: ['earnings'] }); } else` | Needs work | D,I,M,A |
| `src/components/plan-page.tsx:254` | error: `toast.error(t('billing.error'));` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:153` | error: `toast.error(t(recognitionError(error))); await queryClient.invalidateQueries({ queryKey: recognitionKey(teamId) }); }}>{t('teamSpace.unpin')}</Button>}` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:161` | error: `toast.error(t(recognitionError(error))); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:162` | success: `toast.success(t(action === 'pin' ? 'recognition.pinned' : 'recognition.hidden'));` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:192` | error: `toast.error(t(recognitionError(error))); setBusy(false); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:193` | success: `toast.success(t('recognition.shoutoutSent')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:194` | error: `toast.error(t(recognitionError(error))); }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:204` | error: `toast.error(t('profile.photoTooLarge')); return; } setFile(f ?? null); }} /></label>{file && <button type="button" className="auth-link" onClick={() => setFile(null)}>{t('onboarding.removePhoto')}</button>}</div>` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:231` | error: `toast.error(t('recognition.err.claim_blocked')); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:233` | error: `toast.error(t(recognitionError(error))); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:234` | success: `toast.success(t('recognition.homSaved')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:251` | error: `toast.error(t('recognition.err.claim_blocked')); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:253` | error: `toast.error(t(recognitionError(error))); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:254` | success: `toast.success(t('recognition.awarded')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:274` | error: `toast.error(t('recognition.err.claim_blocked')); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:278` | error: `toast.error(t(recognitionError(error))); return; }` | Needs work | D,I,M,A |
| `src/components/recognition.tsx:279` | success: `toast.success(t('recognition.badgeCreated')); await queryClient.invalidateQueries({ queryKey: recognitionKey(teamId) }); onOpenChange(false);` | Needs work | D,I,M,A |
| `src/components/report-button.tsx:25` | error: `toast.error(t(error.message.includes('rate_limited') ? 'report.tooMany' : 'report.error')); return; }` | Needs work | D,I,M,A |
| `src/components/report-button.tsx:26` | success: `toast.success(t('report.thanks')); setOpen(false); setReason(null); setNote('');` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:46` | error: `toast.error(String(error.message).includes('approval_paid') ? t('rsvpq.approvalPaid') : t('profile.saveError')); return false; }` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:53` | error: `toast.error(t('rsvpq.incomplete')); return; }` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:55` | success: `toast.success(t('rsvpq.saved')); }` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:66` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:67` | error: `toast.error(t('profile.saveError')); return; } setToken(data);` | Needs work | D,I,M,A |
| `src/components/rsvp-questions.tsx:67` | success: `toast.success(t('rsvpq.linkReset')); }}><Repeat />{t('rsvpq.resetLink')}</Button></div></div>}` | Needs work | D,I,M,A |
| `src/components/site-media-admin.tsx:81` | success: `toast.success(t('siteMedia.saved'));` | Needs work | D,I,M,A |
| `src/components/site-media-admin.tsx:83` | error: `toast.error(t('siteMedia.error')); } finally { setBusy(false); }` | Needs work | D,I,M,A |
| `src/components/site-media-admin.tsx:92` | error: `toast.error(t('siteMedia.error')); return; }` | Needs work | D,I,M,A |
| `src/components/site-media-admin.tsx:93` | success: `toast.success(t('siteMedia.resetDone')); onClose();` | Needs work | D,I,M,A |
| `src/components/smart.tsx:123` | error: `toast.error(t(error.message.includes('claim') ? 'smart.claims.blocked' : 'profile.saveError')); return false; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:127` | error: `toast.error(t('smart.claims.blocked')); return; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:132` | error: `toast.error(t('smart.followups.err.${res.error}', { defaultValue: t('profile.saveError') })); return; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:133` | success: `toast.success(t('smart.followups.sentVia.${channel}')); onChanged();` | Needs work | D,I,M,A |
| `src/components/smart.tsx:182` | success: `toast.success(t('smart.followups.sentAll', { count: ok })); setProgress(null);` | Needs work | D,I,M,A |
| `src/components/smart.tsx:201` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:201` | success: `toast.success(r.created ? t('smart.followups.prepared', { count: r.created }) : t('smart.followups.noGuests')); await refresh(); }}>{t('smart.followups.prepare')}</Button></div>)}</section>}` | Needs work | D,I,M,A |
| `src/components/smart.tsx:219` | error: `toast.error(t(r.error === 'limit' ? 'assistant.limitReached' : 'assistant.failed')); return; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:228` | error: `toast.error(t(error.message.includes('claim') ? 'smart.claims.blocked' : 'profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/smart.tsx:229` | success: `toast.success(t(published ? 'smart.summary.published' : 'smart.summary.saved')); setDraft(null); setOpen(false); await qc.invalidateQueries({ queryKey: key });` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:63` | error: `toast.error(errorText(t, error)); else await done(); }}>` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:67` | error: `toast.error(t('onboarding.invalidCode')); else await done(); }}>` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:220` | error: `toast.error(errorText(t, error));` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:251` | error: `toast.error(errorText(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:252` | success: `toast.success(t('teamSpace.codeReset'));` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:295` | success: `toast.success(t('teamSpace.teamSaved')); onOpenChange(false);` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:296` | error: `toast.error(errorText(t, error)); }` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:327` | error: `toast.error(errorText(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:328` | success: `toast.success(success); await refresh(); if (close) setSelected(null);` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:372` | success: `toast.success(emailTeam ? t('notify.announceQueued', { count: emailed ?? 0 }) : t('teamSpace.posted')); await refresh();` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:373` | error: `toast.error(errorText(t, error)); }` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:376` | error: `toast.error(errorText(t, error)); await refresh(); };` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:399` | error: `toast.error(errorText(t, error)); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) });` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:411` | error: `toast.error(errorText(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/team-page.tsx:412` | success: `toast.success(t('teamSpace.subteamCreated'));` | Needs work | D,I,M,A |
| `src/components/team-switcher.tsx:15` | error: `toast.error(t('profile.saveError')); }` | Needs work | D,I,M,A |
| `src/components/templates.tsx:71` | error: `toast.error(errText(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/templates.tsx:72` | success: `toast.success(t(publish ? 'templates.launchedToast' : 'templates.draftToast'));` | Needs work | D,I,M,A |
| `src/components/templates.tsx:117` | success: `toast.success(t('templates.saved')); await queryClient.invalidateQueries({ queryKey: ['templates'] }); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onClose();` | Needs work | D,I,M,A |
| `src/components/templates.tsx:118` | error: `toast.error(errText(t, error)); }` | Needs work | D,I,M,A |
| `src/components/templates.tsx:165` | error: `toast.error(errText(t, error)); return; }` | Needs work | D,I,M,A |
| `src/components/templates.tsx:168` | success: `toast.success(t('templates.copied')); if (row) setEditing(toDraft(row));` | Needs work | D,I,M,A |
| `src/components/waiver.tsx:49` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/waiver.tsx:70` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/components/waiver.tsx:71` | success: `toast.success(t('waiver.saved')); void qc.invalidateQueries({ queryKey: ['waiver', teamId] }); void qc.invalidateQueries({ queryKey: ['event-waiver'] }); onClose();` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:27` | success: `toast.success(t('onboarding.copied')); }` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:33` | error: `toast.error(t(String((error as { message?: string }).message ?? '').includes('not_enough') ? 'welcome.notEnough' : 'welcome.error')); return; }` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:34` | success: `toast.success(t('welcome.redeemed', { code: String(code) }));` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:41` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:96` | error: `toast.error(t('welcome.rewardInvalid')); return; }` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:98` | error: `toast.error(t('welcome.error')); return; }` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:103` | error: `toast.error(t('welcome.codeNotFound')); return; }` | Needs work | D,I,M,A |
| `src/components/welcome.tsx:104` | success: `toast.success(t('welcome.honored', { title: (data as { title: string }).title })); setCode(''); await refresh();` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:72` | error: `toast.error(t('profile.saveError')); await refresh(); }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:76` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:78` | message: `toast.message(t('billing.refundNotConnected'));` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:79` | success: `toast.success(t('billing.refundedCount', { count: r.refunded })); else` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:79` | message: `toast.message(t('billing.refundNotConnected')); } catch {` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:79` | error: `toast.error(t('billing.error')); } }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:81` | success: `toast.success(t('notify.cancelQueued', { count: n ?? 0 })); }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:83` | success: `toast.success(t(status === 'published' ? 'templates.launchedToast' : 'gathering.cancelled')); setSheet(null); await refresh();` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:87` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:88` | success: `toast.success(t('gathering.deleted')); await queryClient.invalidateQueries({ queryKey: ['gatherings'] }); void navigate({ to: '/events', search: { tab: 'hosting' } });` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:130` | error: `toast.error(t('profile.saveError')); else await refresh(); }} /></label>` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event.$id.tsx:152` | success: `toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:56` | error: `toast.error(t('profile.saveError')); queue.current.remove(item.key);` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:82` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:176` | error: `toast.error(t('waiver.recordError')); }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:180` | success: `toast.success(t('checkin.walkInAdded', { name: f.first.trim() })); setF(blank); onSaved(); onClose();` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:47` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:48` | success: `toast.success(t(ok ? (st === 'waitlist' ? 'rsvpq.approvedWaitlist' : 'rsvpq.approved') : 'rsvpq.declined')); await refresh();` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:58` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:59` | success: `toast.success(t(status === 'going' ? 'guestList.promoted' : 'guestList.moved')); await refresh();` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:107` | error: `toast.error(t('profile.saveError')); return; }` | Needs work | D,I,M,A |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:108` | success: `toast.success(t('guestList.added')); setF({ name: '', phone: '', email: '', plus: 0 }); onSaved(); onClose();` | Needs work | D,I,M,A |
| `src/routes/r.$code.tsx:35` | error: `toast.error(t('guest.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/routes/r.$code.tsx:36` | success: `toast.success(t(st === 'waitlist' ? 'guest.toastWaitlist' : 'guest.toastSaved')); await refresh();` | Needs work | D,I,M,A |
| `src/routes/r.$code.tsx:40` | error: `toast.error(t('guest.errors.generic')); return; }` | Needs work | D,I,M,A |
| `src/routes/r.$code.tsx:41` | success: `toast.success(t('guest.toastCancelled')); await refresh();` | Needs work | D,I,M,A |

### Other transient feedback (not Sonner toasts)

| State | Score | Needs | Problem |
|---|---|---|---|
| Inline Copied share button | Pass | — | Live team invite switched label to Copied; explicit text + icon; not a toast. |
| Field validation / claim-blocked / upload errors | Needs work | H,I | Localized red text is present, but icon/field-summary hierarchy varies across forms. |
| Guest RSVP confirmed / requested / waitlisted / declined | Needs work | D,S | Distinct truthful messages; confirmation blocks need shared status/radius system; paid populated states unverified. |
| Check-in scanner success/already/error + offline queue notices | Pass | — | Distinct functional states and connection notes; no decorative success effects required. |
| Badge-earned / challenge-finished recognition | Needs work | D,M | Medallions exist; success presentation needs a coherent restrained 150–200ms transition. |
| Notification banners / platform notices / plan past-due | Needs work | H,D | Chip/banner/sheet variants need standardized priority and dismissal treatment. |

## 5. Empty / loading / error state register

| Named state(s) | Source | Score | Needs | Specific gap / positive finding |
|---|---|---|---|---|
| Landing initial ClientOnly frame | landing-chrome.tsx:92 | Needs work | C | Empty fallback div, unlike shared skeleton used by index. |
| Landing no live gatherings | landing-page.tsx | Needs work | C,I | Text/action only; refine without inventing connected/live content. |
| Discover filtered no results | discover-page.tsx:41 | Needs work | C | Plain message; no clear-filter recovery in that empty block. |
| Login email-sent / invalid email / auth error | routes/login.tsx | Pass | — | Clear localized state copy and return action. |
| Onboarding saving / join error | onboarding.tsx | Needs work | C | Saving is bare text; errors localized. |
| Join loading / invalid invite | join.$code.tsx | Needs work | C | Loading minimal; invalid heading/body structured. |
| Friend invite redirect loading | i.$code.tsx | Needs work | H,C | Plain redirect text. |
| Public gathering missing/unavailable / initial loading | e.$id.tsx | Needs work | C | Guest-empty/text-led failure/loading; populated state unverified. |
| RSVP code loading / invalid code | r.$code.tsx | Needs work | C | Plain centered guest-empty message. |
| Guest confirmation / pending request / waitlist | guest-rsvp.tsx | Needs work | D,S | Distinct content exists; shared status composition needed. |
| Credits no media credits | credits.tsx | Needs work | C | Blank list with no empty message. |
| Unsubscribe loading / invalid / saved | unsubscribe.$token.tsx | Pass | — | Distinct content for each state. |
| Home sample stats/events/pulse/follow-ups | gatherwell-pages.tsx | Needs work | C,T | Realistic labeled rows, but stale September samples and tiny metadata; live vs sample boundaries need clarity. |
| Events no real events / sample list | events-page.tsx | Needs work | H,C | Simultaneous empty-create and sample-calendar sections. |
| Gathering workspace/data loading | gathering-form.tsx | Needs work | C | Null loading path rather than skeleton. |
| Event detail loading / not found | event.$id.tsx | Needs work | C | Loading plain text; missing event has return button. |
| Guest list loading / no access / no rows in each status tab | event_.$id.guests.tsx | Needs work | C | Same text-led treatment, little differentiation. |
| Check-in loading / error / no attendees / offline / scanner denied | event_.$id.checkin.tsx | Pass | — | Skeleton/retry, distinct notices and safe-area results. |
| Team no workspace / create-join / no discussions / no subteams / no wins / no announcements | team-page.tsx; conversation.tsx | Needs work | H,C | Mix of inline form, paragraph, blank-looking panel and sample rows; no single empty-state specification. |
| Team templates/challenges sample fallbacks | templates.tsx; challenges.tsx | Needs work | I,C | Labels truthful; feature cover/row treatment varies. |
| Member roster no match / no name / member detail | team-page.tsx | Needs work | C,H | List fallback exists; member detail primarily administrative with sparse identity. |
| Insights no hosts / templates / nudges / sample benchmark | insights-page.tsx; playbook.tsx | Needs work | C,I,S | Dedicated text/sample copy exists; Playbook broken accent token and fractional spacing. |
| Map missing key / load failure / no events / no near matches | map-page.tsx | Needs work | C | Good labeled map placeholder; event loading conflated with no results. |
| Network no connections / requests / local hosts / shared events | network-page.tsx | Needs work | C,D | Text-led empty sections; no refined shared composition. |
| Learn no tracks / no live sessions / sample tracks | learn.tsx | Needs work | I,C | Samples correctly labeled; monogram covers basic. |
| Track not found / lesson not found / player no source / course locked | learn.tsx | Needs work | C,I | Plain missing/player/lock messaging inconsistent with admin-denied feature state. |
| Lesson completion / track completion | learn.tsx | Needs work | D,M | Dedicated completion card exists, but no coherent cross-feature success system. |
| Recipes empty / recipe loading | learn.tsx | Needs work | C | Recipe blank-div path rather than shared skeleton. |
| Me no gatherings / challenges / badges / teams / purchases / welcome referrals | me-page.tsx; offers.tsx; welcome.tsx | Needs work | C,D | Several paragraph-only sheets; zero stats and nested reward containers; undefined radii. |
| Offers unauthorized / no offers / offer not found / owned / payment pending | offers.tsx | Needs work | C,I,D | Bare permission/lock/purchase states; ownership and confirmation need coherent state hierarchy. |
| Plan loading / no license / payment unconnected / past due | plan-page.tsx | Needs work | C,H | Plain loading; other states have real copy/action but status hierarchy varies. |
| Earnings no payments / no referrals / no rewards | plan-page.tsx; welcome.tsx | Needs work | C,S | Zero metrics without context; reward tokens undefined. |
| Follow-up inbox no drafts / no guests / preview | smart.tsx | Needs work | C,D | Text-led empty panel, clear preview label; no-data supplemental cards can intentionally be omitted. |
| Assistant idle / waiting / preview / quota / failure / action confirmed | assistant-panel/cards.tsx | Needs work | D,I,M | Custom panel and cards need shared success/error foundation; provider behavior not tested. |
| Conversation no comments / no topics / hidden / reply denied / claim blocked | conversation.tsx | Needs work | C,S | Mostly paragraphs and inline notices; dense nested spacing; native delete confirm. |
| Admin loading / denied / empty teams / people / reports / audit / library | admin-console.tsx | Needs work | C | Outer skeleton and denied feature tile good; inner loading/empty lists plain. |
| Site media loading / denied / missing photo / upload failure | site-media-admin.tsx; brand-image.tsx | Needs work | C | Loading plain text; denied tile and tonal photo fallback are good baselines. |
| Global 404 / retry / slow connection / skeleton | __root.tsx; launch-states.tsx | Pass | — | Refined shared states exist; adoption is incomplete rather than missing. |

## 6. Checklist rollup and foundation work order (not implemented)

| Criterion | Verdict | Foundation requirement |
|---|---|---|
| H — hierarchy | Needs work | Group Me sections and dangerous actions; identity-led member profile; standard popup header/body/footer roles. |
| D — depth | Needs work | Define explicit elevation roles and resolve permanent shadow-cap conflict before implementation; distinct canvas/card/popover/modal surfaces. |
| I — icons | Needs work | Remove forced 16px action icons; all status icons through GwIcon; canonical feature-tile/medallion roles, with documented compact exceptions. |
| S — spacing | Needs work | Restore missing radius tokens; replace drift with spacing roles on 8px grid; do not treat every multiple of 4 as strict 8px compliance. |
| T — typography | Needs work | One app type system; clear title/body/meta sizes; remove landing serif/type drift and reduce tiny metadata where readability suffers. |
| C — content/states | Needs work | Standard composed empty/loading/error/permission/preview states; preserve Sample truthfulness and real-vs-sample separation. |
| M — motion | Needs work | 150–200ms open/close/success roles; keep existing reduced-motion handling; replace native app confirmations and custom-menu instant unmount. |
| A — mobile | Needs work | Minimum width as well as height; popup footer/scroll boundaries; floating-action obstruction; focus trap/return in public menu; real safe-area device review. |
| L — light/dark | Needs work | Existing tokens generally repaint correctly; native confirms and canvas/modal surface mismatch break consistency; full populated-state contrast review remains open. |
| B — English/Spanish | Needs work | Resource keys match; replace hardcoded admin options; verify long names/labels and dynamic content in all populated overlays, not only Me. |

**Suggested order:** (1) token/surface/type/icon/motion foundation; (2) Me + member profile; (3) shared overlays/confirmations/toasts/menus; (4) compose empty states; (5) migrate screen-specific drift; (6) full light/dark + EN/ES + mobile verification. This is a remediation order only; no visual choice or code change is approved by the audit itself.

## 7. Evidence and remaining verification

Screenshots and scripts are temporary audit evidence under `/tmp/browser/design-audit/`, not app assets or deliverables:
- `me.png`, `member-profile-desktop.png`, `gatherings-empty-desktop.png`, `create-sheet-desktop.png`, `assistant-desktop.png`.
- `me-{375,414,1440}-{en,es}-{light,dark}.png` and matching edit-profile screenshots.
- `results.json`, `focused-results.json`: route headings, errors, overflow, targets, dialog measurements.
- `surface-callers.txt`, `toast-callers.txt`, `route-metadata.txt`: source manifests.

Confirmed live: Me no horizontal overflow at measured widths; Spanish/light and English/dark layouts loaded; keyboard Escape dismissed inspected Radix dialogs; invite Copy changed the action label; member and empty-gatherings dialogs visibly use the muted canvas surface. Computed drawer scroll-height included extra Vaul layout extent; screenshot showed the form fitting in the tested 1000px-high viewport, so that measurement alone is **not** reported as a clipping defect.

Not verified: every populated event/cohost/paid/second-person state; delivered toast stack appearance; keyboard traversal/return across every sheet/menu; contrast ratios for every state; 100%-zoom real-device safe-area and virtual-keyboard behavior; exhaustive long Spanish editorial fit; provider/production performance. These are verification gaps, not invented visual failures.

All 40 content route files have a head definition. Some reuse generic tab metadata (e.g. gathering create/edit use Events; Earnings uses Me), so app-specific unique detail titles remain a separate metadata consistency finding. No head or route files were changed during this documentation-only task.

## 8. Source completeness appendix

The following manifest preserves every literal overlay, dialog-role, Select/native-select and native-confirm occurrence outside UI definitions. Import-only references are omitted. It complements the named register above, including mutually exclusive states and dormant triggers, rather than counting one reusable sheet as dozens of invented screens.

| Source occurrence | Surface declaration / trigger | Score |
|---|---|---|
| `src/components/admin-console.tsx:136` | `return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={team?.name ?? t('admin.loading')} description={team ? '${t('admin.teams.leader')}: ${team.leader_name ?? '—'}' : ''}>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:144` | `<div className="admin-action-row"><label className="field-label" htmlFor="adm-plan">{t('admin.teams.plan')}</label><select id="adm-plan" className="field-input" value={plan} onChange={e => setPlan(e.target.value as typeof plan)}>{(['free', 'growth', 'pro'] as const).map(p => <option key={p} value={p}>{t('admin.plan.${p}')}</option>)}</select><Button variant="secondary" disabled={busy} onClick={() => run('plan')}>{t('admin.teams.changePlan')}</Button></div>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:146` | `<div className="admin-action-row"><label className="field-label" htmlFor="adm-tier">{t('admin.teams.licenseTier')}</label><select id="adm-tier" className="field-input" value={tier} onChange={e => setTier(e.target.value as typeof tier)}><option value="team25">Team 25</option><option value="team100">Team 100</option></select><Button variant="secondary" disabled={busy} onClick={() => run('license')}>{t('admin.teams.grantLicense')}</Button></div>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:184` | `return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={u?.full_name \|\| u?.email \|\| t('admin.loading')} description={u?.email ?? ''}>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:316` | `return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={item ? t('admin.lib.editTitle') : t('admin.lib.newTitle', { kind: t('admin.lib.kind.${kind}') })} description={t('admin.lib.claimRule')}>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:323` | `<div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="lib-icon">{t('admin.lib.f.icon')}</label><select id="lib-icon" className="field-input" value={f['icon']} onChange={set('icon')}>{['Award', 'Medal', 'Trophy', 'Star', 'Heart', 'HandHeart', 'Flame', 'Crown', 'CalendarHeart', 'UsersRound', 'Footprints', 'Leaf', 'Rocket', 'Megaphone'].map(i => <option key={i} value={i}>{i}</option>)}</select></div>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:324` | `<div className="form-field"><label className="field-label" htmlFor="lib-tier">{t('admin.lib.f.tier')}</label><select id="lib-tier" className="field-input" value={f['tier']} onChange={set('tier')}>{['bronze', 'silver', 'gold'].map(x => <option key={x} value={x}>{t('admin.lib.tier.${x}')}</option>)}</select></div></div></>}` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:353` | `<div className="form-field"><label className="field-label" htmlFor="bc-aud">{t('admin.bc.audience')}</label><select id="bc-aud" className="field-input" value={f.audience} onChange={set('audience')}><option value="leaders">{t('admin.bc.leaders')}</option><option value="members">{t('admin.bc.members')}</option></select></div>` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:386` | `{fl.key === 'landing_headline' && <select aria-label={t('admin.flags.variant')} className="field-input flag-select" value={fl.value ?? 'A'} onChange={e => update(fl.key, fl.enabled, e.target.value)}>{['A', 'B', 'C', 'D'].map(v => <option key={v} value={v}>{t('admin.flags.headline', { v })}</option>)}</select>}` | Needs work — shared surface / state findings above |
| `src/components/admin-console.tsx:400` | `<div className="admin-toolbar"><Search value={q} onChange={setQ} label={t('admin.audit.search')} /><select aria-label={t('admin.audit.area')} className="field-input audit-area" value={area} onChange={e => setArea(e.target.value as typeof area)}>{AREAS.map(a => <option key={a} value={a}>{t('admin.audit.areas.${a}')}</option>)}</select></div>` | Needs work — shared surface / state findings above |
| `src/components/assistant/assistant-panel.tsx:94` | `<DrawerContent className="as-drawer"><DrawerTitle className="sr-only">{t('assistant.title')}</DrawerTitle><DrawerDescription className="sr-only">{t('assistant.title')}</DrawerDescription>{body}</DrawerContent>` | Needs work — shared surface / state findings above |
| `src/components/assistant/assistant-panel.tsx:97` | `<SheetContent side="right" className="as-panel"><SheetTitle className="sr-only">{t('assistant.title')}</SheetTitle><SheetDescription className="sr-only">{t('assistant.title')}</SheetDescription>{body}</SheetContent>` | Needs work — shared surface / state findings above |
| `src/components/challenges.tsx:113` | `if (!draft?.id \|\| !window.confirm(t('challenges.confirmDelete'))) return;` | Needs work — shared surface / state findings above |
| `src/components/challenges.tsx:119` | `return <ResponsiveSheet open={!!draft} onOpenChange={o => !o && onClose()} title={draft?.id ? t('challenges.edit') : t('challenges.new')} description={t('challenges.claimRule')}>` | Needs work — shared surface / state findings above |
| `src/components/challenges.tsx:186` | `return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('challenges.checkInFor', { date: date === localDate() ? t('challenges.today') : t('challenges.yesterday') })}>` | Needs work — shared surface / state findings above |
| `src/components/challenges.tsx:208` | `<ResponsiveSheet open={open} onOpenChange={setOpen} title={t('challenges.sendCheer')} description={t('challenges.cheerText')}>` | Needs work — shared surface / state findings above |
| `src/components/cohosts.tsx:47` | `<ResponsiveSheet open={open} onOpenChange={setOpen} title={t('cohosts.pickTitle')} description={t('cohosts.pickHelp', { max: MAX_COHOSTS })}>` | Needs work — shared surface / state findings above |
| `src/components/conversation.tsx:61` | `<ResponsiveSheet open={picking} onOpenChange={setPicking} title={t('conversation.mention')}>` | Needs work — shared surface / state findings above |
| `src/components/conversation.tsx:86` | `{(x.author_id === me \|\| feed.can_moderate) && <button type="button" className="convo-react" aria-label={t('conversation.delete')} onClick={() => { if (window.confirm(t('conversation.deleteConfirm'))) void act('delete_comment', { _id: x.id }, 'conversation.deleted'); }}><Trash2 /></button>}` | Needs work — shared surface / state findings above |
| `src/components/conversation.tsx:156` | `<ResponsiveSheet open={creating} onOpenChange={setCreating} title={t('conversation.newTopic')}>` | Needs work — shared surface / state findings above |
| `src/components/conversation.tsx:163` | `<ResponsiveSheet open={!!open} onOpenChange={o => !o && setOpen(null)} title={current?.title ?? t('conversation.discussions')}>` | Needs work — shared surface / state findings above |
| `src/components/conversation.tsx:165` | `<Button variant="ghost" className="danger-text" onClick={() => { if (window.confirm(t('conversation.deleteTopicConfirm'))) void manage({ _delete: true }); }}><Trash2 />{t('conversation.deleteTopic')}</Button></div>}` | Needs work — shared surface / state findings above |
| `src/components/event-live.tsx:112` | `return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('live.addPoll')}>` | Needs work — shared surface / state findings above |
| `src/components/gatherwell-shell.tsx:72` | `<DrawerContent className="gatherwell-sheet"><div className="sheet-heading"><div><DrawerTitle>{detail ? detail.title : sheet === 'create' ? t('create.title') : sheet === 'assistant' ? t('common.assistant') : sheet ? t('placeholder.${sheet}') : ''}</DrawerTitle><DrawerDescription className={sheet === 'create' ? 'mt-3' : 'sr-only'}>{sheet === 'create' ? t('create.description') : t('common.comingSoon')}</DrawerDescription></div><Button variant="ghost" size="icon" onClick={() => setSheet(null)} aria-label={t('common.close')}><X /></Button></div>` | Needs work — shared surface / state findings above |
| `src/components/guest-rsvp.tsx:106` | `return <ResponsiveSheet open={!!intent} onOpenChange={o => !o && onClose()} title={title} description={event.title}>` | Needs work — shared surface / state findings above |
| `src/components/insights-page.tsx:98` | `<SelectContent><SelectItem value="all">{t('insights.wholeOrg')}</SelectItem>{tree.filter(n => n.depth > 0).map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select>}` | Needs work — shared surface / state findings above |
| `src/components/insights-page.tsx:121` | `<ResponsiveSheet open={!!shout} onOpenChange={o => !o && setShout(null)} title={t('insights.shoutTitle', { name: shout?.name ?? '' })} description={t('insights.shoutHelp')}>` | Needs work — shared surface / state findings above |
| `src/components/insights-page.tsx:125` | `<ResponsiveSheet open={!!nudge} onOpenChange={o => !o && setNudge(null)} title={t('insights.checkInTitle', { name: nudge?.name ?? '' })} description={t('insights.noAutoSend')}>` | Needs work — shared surface / state findings above |
| `src/components/landing/landing-chrome.tsx:44` | `{open && <div className="gw-menu-sheet" role="dialog" aria-modal="true" aria-label={t('landing.nav.main')}>` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:62` | `if (!track?.id \|\| !window.confirm(t('learnHub.confirmDeleteTrack'))) return;` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:67` | `return <ResponsiveSheet open={!!track} onOpenChange={o => !o && onClose()} title={track?.id ? t('learnHub.editTrack') : t('learnHub.newTrack')}>` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:122` | `if (!lesson?.id \|\| !window.confirm(t('learnHub.confirmDeleteLesson'))) return;` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:128` | `return <ResponsiveSheet open={!!lesson} onOpenChange={o => !o && onClose()} title={lesson?.id ? t('learnHub.editLesson') : t('learnHub.newLesson')}>` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:212` | `if (!recipe?.id \|\| !window.confirm(t('learnHub.confirmDeleteRecipe'))) return;` | Needs work — shared surface / state findings above |
| `src/components/learn-manage.tsx:218` | `return <ResponsiveSheet open={!!recipe} onOpenChange={o => !o && onClose()} title={recipe?.id ? t('learnHub.editRecipe') : t('learnHub.addRecipe')} description={t('learnHub.recipeRule')}>` | Needs work — shared surface / state findings above |
| `src/components/map-page.tsx:88` | `<SelectContent><SelectItem value="all">{t('insights.wholeOrg')}</SelectItem>{tree.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select>}` | Needs work — shared surface / state findings above |
| `src/components/map-page.tsx:98` | `<ResponsiveSheet open={!!picked} onOpenChange={o => !o && setPicked(null)} title={picked?.title ?? ''}>` | Needs work — shared surface / state findings above |
| `src/components/me-page.tsx:97` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('profile.editTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/me-page.tsx:217` | `<ResponsiveSheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }} title={panel ? panels[panel].title : ''}>{panel && panels[panel].body}</ResponsiveSheet>` | Needs work — shared surface / state findings above |
| `src/components/me-page.tsx:218` | `<ResponsiveSheet open={deleting} onOpenChange={setDeleting} title={t('profile.deleteTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/notifications.tsx:60` | `return <ResponsiveSheet open onOpenChange={o => !o && setReason(null)} title={t('notify.pushTitle')} description={t('notify.pushWhy.${reason}')}>` | Needs work — shared surface / state findings above |
| `src/components/offers.tsx:96` | `if (!offer?.id \|\| !window.confirm(t('offers.confirmDelete'))) return;` | Needs work — shared surface / state findings above |
| `src/components/offers.tsx:103` | `return <ResponsiveSheet open={!!offer} onOpenChange={o => !o && onClose()} title={offer?.id ? t('offers.edit') : t('offers.new')}>` | Needs work — shared surface / state findings above |
| `src/components/offers.tsx:222` | `if (!window.confirm(t('offers.confirmCancel'))) return;` | Needs work — shared surface / state findings above |
| `src/components/offers.tsx:271` | `<select id={'mo-${id}'} className="field-input" value={current ?? ''} onChange={e => void change(e.target.value)}>` | Needs work — shared surface / state findings above |
| `src/components/plan-page.tsx:24` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('billing.notConnectedTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/plan-page.tsx:52` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('billing.limitTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/plan-page.tsx:164` | `<ResponsiveSheet open={downgrade !== null} onOpenChange={o => { if (!o) setDowngrade(null); }} title={t('billing.downgradeTitle', { plan: downgrade ? t('billing.name_${downgrade}') : '' })}>` | Needs work — shared surface / state findings above |
| `src/components/plan-page.tsx:273` | `<ResponsiveSheet open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }} title={confirm?.eventId ? t('billing.refundAll') : t('billing.refund')}>` | Needs work — shared surface / state findings above |
| `src/components/recognition.tsx:113` | `return <ResponsiveSheet open onOpenChange={o => { if (!o) void close(); }} title={t('recognition.earnedTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/recognition.tsx:197` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.giveShoutout')} description={t('recognition.shoutoutText')}>` | Needs work — shared surface / state findings above |
| `src/components/recognition.tsx:236` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.nameHost')} description={t('recognition.nameHostText')}>` | Needs work — shared surface / state findings above |
| `src/components/recognition.tsx:256` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.awardBadge')}>` | Needs work — shared surface / state findings above |
| `src/components/recognition.tsx:283` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.newBadge')}>` | Needs work — shared surface / state findings above |
| `src/components/report-button.tsx:32` | `<ResponsiveSheet open={open} onOpenChange={setOpen} title={t('report.title')} description={t('report.subtitle')}>` | Needs work — shared surface / state findings above |
| `src/components/responsive-sheet.tsx:10` | `<DrawerContent className="gatherwell-sheet responsive-sheet"><DrawerTitle className="sheet-title">{title}</DrawerTitle>{description ? <DrawerDescription className="sheet-description">{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}<div className="sheet-body">{children}</div></DrawerContent>` | Needs work — shared surface / state findings above |
| `src/components/responsive-sheet.tsx:13` | `<DialogContent className="responsive-dialog"><DialogTitle className="sheet-title">{title}</DialogTitle>{description ? <DialogDescription className="sheet-description">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}<div className="sheet-body">{children}</div></DialogContent>` | Needs work — shared surface / state findings above |
| `src/components/site-media-admin.tsx:98` | `<ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} title={row.slot} description={t('siteMedia.editHint')}>` | Needs work — shared surface / state findings above |
| `src/components/team-page.tsx:150` | `{isLeader && <ResponsiveSheet open={sheet === 'subteams'} onOpenChange={o => !o && setSheet(null)} title={t('teamSpace.subteams')}><SubTeamSettings teamId={teamId} allowHosts={!!team?.allow_host_subteams} /></ResponsiveSheet>}` | Needs work — shared surface / state findings above |
| `src/components/team-page.tsx:257` | `<ResponsiveSheet open={open && !qr} onOpenChange={onOpenChange} title={t('teamSpace.invite')} description={t('teamSpace.inviteText', { team: workspace.name })}>` | Needs work — shared surface / state findings above |
| `src/components/team-page.tsx:270` | `<DialogContent className="qr-fullscreen"><DialogTitle className="sr-only">{t('teamSpace.qr')}</DialogTitle><DialogDescription className="sr-only">{link}</DialogDescription>` | Pass |
| `src/components/team-page.tsx:300` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('teamSpace.editTeam')}>` | Needs work — shared surface / state findings above |
| `src/components/team-page.tsx:332` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={selected ? (selected.name ?? t('teamSpace.someone')) : t('teamSpace.members')}>` | Needs work — shared surface / state findings above |
| `src/components/team-page.tsx:377` | `return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('teamSpace.announce')}>` | Needs work — shared surface / state findings above |
| `src/components/team-switcher.tsx:28` | `<SelectContent>{(teams.some(team => team.teamId === active.teamId) ? teams : [...teams, active]).map(team => <SelectItem key={team.teamId} value={team.teamId}>{team.name} · {t('roles.${team.role}')}</SelectItem>)}</SelectContent>` | Needs work — shared surface / state findings above |
| `src/components/templates.tsx:76` | `return <ResponsiveSheet open={!!template} onOpenChange={o => !o && onClose()} title={template?.title ?? ''} description={t('templates.launchText')}>` | Needs work — shared surface / state findings above |
| `src/components/templates.tsx:126` | `return <ResponsiveSheet open={!!draft} onOpenChange={o => !o && onClose()} title={draft?.id ? t('templates.editTitle') : t('templates.newTitle')}>` | Needs work — shared surface / state findings above |
| `src/components/waiver.tsx:73` | `return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('waiver.editTitle')} description={t('waiver.editHelp')}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event.$id.tsx:151` | `<ResponsiveSheet open={sheet === 'share'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.share')} description={event.title}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event.$id.tsx:162` | `<ResponsiveSheet open={sheet === 'cancel'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.cancelTitle')} description={t('gathering.cancelText')}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event.$id.tsx:167` | `<ResponsiveSheet open={sheet === 'delete'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.deleteTitle')} description={t('gathering.deleteText')}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:150` | `return <div className="scanner" role="dialog" aria-modal="true" aria-label={t('checkin.scan')}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event_.$id.checkin.tsx:182` | `return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('checkin.walkIn')}>` | Needs work — shared surface / state findings above |
| `src/routes/_authenticated/_app/event_.$id.guests.tsx:110` | `return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('guestList.add')}>` | Needs work — shared surface / state findings above |
| `src/routes/r.$code.tsx:61` | `<ResponsiveSheet open={confirmCancel} onOpenChange={setConfirmCancel} title={t('guest.cancelRsvpTitle')} description={t('guest.cancelRsvpText')}>` | Needs work — shared surface / state findings above |

## Phase 6 — Verification and rescoring (Oct 6 2026)
Checked Home, Events, Team, Learn, Me and Network at 375px (Spanish, dark) and 1440px (English, light): no page errors, no sideways overflow.
- P0 missing tokens: Pass (defined in Phase 1).
- Popups (D, M): Pass — card surface, e3 elevation, 220/160ms motion, branded confirm replaces every native confirm.
- Me and member profile (H, C): Pass — identity hero, stats, grouped settings.
- Empty/loading/error (C, M): Pass — shared EmptyState tiles, shimmer skeletons, titled retry state; full-page loading blocks replaced by a thin top bar after verification showed them pushing loaded content down.
- Spacing (S): Pass — 88 off-grid values snapped to the 8px grid.
- Still open: member profiles of other people, popup drag-to-dismiss and admin dropdown labels not verified on screen; populated states need real gatherings.


## Design System 2.0 continuation — October 7, 2026

### Phase 2 — shared overlays
**Pass (verified samples):** Dialog/Drawer/Sheet viewport bounds, blurred dimming, elevation, shared feature-tile headers, scrollable sheet bodies and fixed action footers. Select/context/dropdown items have 48px targets. Toast placement is phone bottom-center above navigation and desktop bottom-right; swipe-dismiss passed at 375px and 414px. Native confirmation call sites: zero. Team invite reset, admin account actions, broadcasts and calendar reset use the shared premium confirmation; typed account DELETE remains intact. Confirmation requests queue instead of overwriting each other.

Spanish admin icon selector: all 14 options displayed localized labels with shared icons. Public mobile navigation: ten consecutive Tab presses stayed inside the menu; Escape closed it and focus returned to the trigger.

### Phase 3 — identity and profiles
**Pass (verified samples):** Me at 375px Spanish/dark, 414px English/light and 1440px English/dark; host/team public identities at 375px Spanish/dark, 414px English/light and 1440px Spanish/light. Public identities now have graded shared photography, strong titles, safe avatars and one primary follow action. Me sheets use purpose-specific icon headers. Member details were opened at 375px Spanish/dark; narrow activity stats were changed to two columns after visible label crowding was found. Other-person profiles remain unverified; only the current account was opened.

### Phase 4 — states
**Pass (source + visible empty/unavailable samples):** host/team upcoming-empty states, localized unavailable page, shared list skeleton and retry treatments on public routes/calendar. Screens are not bare empty panels. Deliberately induced network-error/retry and populated gathering lists were not exercised in this continuation.

### Phase 5 — screen drift
**Pass (verified samples):** follow form hierarchy, inline fine print, submit footer, calendar privacy note and grouped feed rows. Long bilingual provider labels wrap within 48px-minimum actions. Confirm buttons wrap instead of clipping. Calendar's long body scrolls inside the bounded sheet. No database/business-flow changes were required.

### Phase 6 — verification evidence and limits
- Browser checks: host, team, email-follow, Me, calendar and cancel-only confirmation at 375/414/1440px in the language/theme combinations above. No document overflow or page errors observed.
- Read-only admin library check plus unsaved badge editor: Spanish Select labels verified visually.
- Authenticated Home, Gatherings, Learn, Network and Team checked at 375px Spanish/dark: no overflow or page errors observed.
- Team invite reset confirmation opened and cancelled; no codes or calendar tokens rotated. Follow email form checked without submission. No test posts/accounts/gatherings were created.
- Automatic build log: latest recorded build OK; no remaining reported type errors.
- Evidence: `/tmp/browser/design-continuation/` screenshots, results.json and run logs (sandbox verification artifacts, not app assets).
- Still open: exhaustive overlay permutations, other-account profile, true populated gatherings, provider/client calendar integration, full contrast audit, reduced-motion emulation and real touch-device drawer gestures. Desktop-mouse toast swipe passed; mobile drawer drag was not asserted, so it is not recorded as a verified pass.

This continuation updates the prior inventory; historical Needs-work rows describe the audit baseline, not a claim that every row received an individual live retest.

## N2 — Public discovery, hosting and pricing verification
- Added public `/hosts` and `/pricing`, with matching desktop navigation and focus-trapped bilingual mobile menu.
- Landing keeps its hero and Live Stack, highlights Pilates instead of Sound baths, retains Hikes, and opens the full category picker from More. Existing Sound bath gatherings remain supported.
- Guest journey: Find it, RSVP, Show up. Host band links to the dedicated hosting page.
- Hosts page: six benefits with marketing-duotone tiles and sample vignettes, four hosting steps, team-leader band, shared pricing preview, FAQ, final CTA and mobile sticky hosting action.
- Pricing uses existing PLANS and LICENSES constants: monthly/annual plan toggle, comparison table, 25/100-member monthly licenses, plain FAQs and transparent service/fee notes.
- Host category selector includes all categories plus Other with a custom label; create/edit RPCs persist categories and the public feed renders custom labels. Pilates receives the existing in-person activity waiver default.
- Landing sticky CTA remains Find a gathering. Disabled `landing_sticky_host_experiment` enables a session-stable 50/50 host/find test when deliberately switched on; exposure and click analytics include variant and page.
- Browser checks: landing, Hosts and Pricing at 390px and 1440px, English and Spanish. No horizontal overflow or page errors. Category picker, mobile navigation, annual prices, FAQ expansion and hosting sticky action verified.
- Signed-in phone checks: Pilates selection, Other label entry and Discover navigation verified in both languages; no overflow or page errors.
- Visual inspection caught and fixed inherited 200px mobile CTA flex sizing and missing tile background token. Buttons now have 52px height and feature tiles use the shared secondary tint.
- Build harness: latest completed build passed. No provider secrets or payment configuration changed. Purchase journeys and new-gathering publication were not exercised in this UI verification.
