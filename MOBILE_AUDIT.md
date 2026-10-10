# Gatherwell — detailed mobile audit
**Review date:** October 10, 2026  
**Scope:** Alignment, overlapping content, bilingual fit, phone navigation, forms, popups, touch targets, and consistency.  
**Verdict:** **Needs focused mobile fixes before a full mobile sign-off.** The tested main public pages align well, but three Spanish unavailable-page states overflow and several controls are smaller than the project standard. Signed-in screens have source review only, not a complete visual sign-off.

## 1. Executive summary

This audit is not an “everything is clean” claim. It separates observed defects from possible risks and states that could not be exercised.

- **122 recorded browser states** across page, popup, form, theme and language checks; these are test states, not 122 different screens.
- **22 public URL scenarios** checked at 375px in both English and Spanish. The six principal pages were also checked at 390px and 414px.
- Additional checks covered actual public host/team pages, a published public gathering, follow-by-email, sample gathering preview, RSVP feedback, empty contact validation, menus on short phones, dark styling and reduced motion.
- **Three confirmed horizontal-overflow states:** Spanish missing host, team and location pages at 375px.
- **Confirmed undersized controls:** follow email input, clickable category chips, language buttons, footer links, and several 44px controls that fall below the current 48px mobile standard.
- **No uncaught page exceptions** recorded in the 68-state page pass after waiting for actual content.
- **42 existing automated tests pass.** These test routing/domain rules; they do not prove visual alignment or real paid checkout.
- Signed-in host/member/admin forms, onboarding, quick start, check-in, profile editing and photo cropping remain **visually unverified** in this run.
- **No application fixes were made.** This is an audit and prioritized correction list, not a silent redesign.

## 2. How the audit was performed

### Phone sizes
- 375 × 812: principal narrow-phone review.
- 390 × 844 and 414 × 896: principal public pages.
- 375/390/414 × 667: public guest, host/team and follow-popup checks.
- 375 × 568: compact-height public menu check.
- 375 × 812: dark-theme sample preview and reduced-motion checks.

English and natural Latin American Spanish were both exercised. Browser checks ran against the current local preview with real browser rendering. Source review followed DESIGN_RULES.md and PROJECT_RULES.md, including the later CSS overrides rather than only the earliest definitions.

### Measures
- Whole-document width compared with viewport width.
- Screenshot inspection of actual rendered content.
- Bounds and dimensions of controls.
- Menu opening, tab focus containment, Escape dismissal and focus restoration.
- Sample gathering opening and sample RSVP feedback.
- Populated guest-form labels and missing-contact validation, without creating an RSVP.
- Follow email sheet opening, disabled submit state and measured field size, without following or sending email.
- Latest preview build log and the existing test suite.

### Important exclusions
This was not a physical iPhone/Android test. The software keyboard, iOS input autozoom and actual notch/home-indicator insets were not physically exercised. No credentials were bypassed; no other person's account was selected. No guest registrations, purchases, notifications, uploads or live user-data edits were performed.

Initial rapid screenshots included unfinished loading states. Those were discarded and the page checks repeated after content rendered; they are **not** reported as broken blank pages.

## 3. Confirmed findings

### M01 — Spanish unavailable pages push the action off the phone
**Priority: High. Status: Browser-confirmed.**

Affected states:
- `/h/missing`: document 380px wide on a 375px viewport.
- `/t/missing`: document 380px wide on a 375px viewport.
- `/l/missing`: document 403px wide on a 375px viewport.

The icon, explanatory text and “Descubrir reuniones” action are held in one horizontal empty-state row. The action clips beyond the right edge; the location explanation becomes an unnecessarily narrow multi-line column. This is a genuine layout failure, not an intended horizontal carousel.

**Cause:** `EmptyState` at `src/components/launch-states.tsx:20–21`, combined with `.gw-empty-state` at `src/styles.css:1363` and the action button's no-wrap styling. Host/team callers share `src/components/follow.tsx:51`; location uses the same state pattern.

**Correction:** Make action-bearing empty states a mobile grid with a shrinkable text column and a full-width action below it. Keep the current desktop arrangement. Verify both languages and long error messages at 375/390/414px.

### M02 — Follow-by-email field is only 36px tall
**Priority: Medium. Status: Browser-confirmed.**

The follow sheet itself aligns and scrolls correctly, but the email input measures **36px high**, with 16px text. It is noticeably shorter than the 48px Follow action beneath it and below the project's phone target.

**References:** `src/components/follow.tsx:109–111`; `src/components/ui/input.tsx:11` sets the base input to `h-9`.

**Correction:** Give the shared mobile text input a minimum 48px height, preserving smaller desktop sizes. Check all callers, rather than fixing this one field only.

### M03 — Clickable gathering category chips are only 30px tall
**Priority: Medium. Status: Browser-confirmed.**

On Discover, the clickable “Pilates” chip measures **87 × 30px**. These chips navigate to category results, so they are actions, not decorative labels. Other landing gathering chips have the same small height.

**References:** `src/components/landing/gathering-card.tsx:84–87`; the gathering-chip CSS. Category-circle navigation is separate and does not have this small-target issue.

**Correction:** Expand the clickable chip hit area to the phone standard while keeping the refined small-chip appearance if desired. Check that enlarged chip areas do not collide with the adjacent spots/weekend badge or the card title.

### M04 — Main controls mix 36px, 40px, 44px, 48px and 52px heights
**Priority: Medium. Status: Measurements plus confirmed source inconsistency.**

Measured examples:
- Follow email: 36px.
- Guest RSVP text fields: 44px, all with 16px text.
- Discover RSVP button: 44px.
- Discover card title action: 44px.
- Top EN/ES buttons: 32px wide × 44px tall.
- Marketing footer links: typically 40px tall; bottom Terms/Privacy text links are about 16px high.
- Compact 568px-height menu: Get started/Comenzar shrinks to approximately **36px** tall as the flex layout compresses.
- Primary guest confirmation: 52px; shared standard mobile buttons generally 48px.

A 44px control is not automatically broken, but it does not meet the current **48px minimum** requirement. The inconsistent field/button heights also weaken the “everything matching” goal.

**References:** `src/styles.css:43,68,76,750–751,841,1075,1472`; `src/components/landing/landing-chrome.tsx:19–20,83,96–98`.

**Correction:** Establish one mobile minimum and prevent fixed actions from flex-shrinking. Use expanded hit areas for compact visual controls when appropriate. Footer links need spacing and adequate hit areas, not merely larger text.

### M05 — Public host fallback avatar appears narrow and oval
**Priority: Low. Status: Screenshot-confirmed in the tested no-photo host state.**

On the real public host page tested, the “N” avatar fallback renders as a narrow white pill rather than a stable square/circle. The surrounding name, Follow action and profile blocks stay within the viewport.

**References:** `src/components/follow.tsx:40–42` returns a `span.follow-avatar.is-initials`; inspect `.follow-avatar` and its display/width behavior in `src/styles.css`.

**Correction:** Give image and initials avatar variants the same stable width, height, display and circular geometry. Recheck one-letter and two-letter initials plus actual photos.

## 4. Source-backed gaps and risks — not proven on a signed-in phone

These should not be labeled confirmed overlaps. They require authenticated visual tests or physical-device checks.

### R01 — Some sheet actions still live inside the scrolling content
**Priority: Medium. Evidence: Source-confirmed structure; keyboard impact unverified.**

Examples:
- New discussion: `src/components/conversation.tsx:160–165` places Create inside the form/body rather than the shared sheet footer.
- Account deletion: `src/components/me-page.tsx:282–290` places the destructive action inside the body.
- Team announcement: `src/components/team-page.tsx:386–401` uses a sheet without the shared footer.
- Several recognition sheets use body-contained actions; compare `recognition.tsx:221,262,281,301,331` with its footer-based event badge sheet at `437`.

The shared ResponsiveSheet already supports fixed headers/footers and scrolling bodies. These callers do not consistently use that capability. On short phones with a keyboard open, a primary action may need extra scrolling.

**Correction:** Move primary submit/confirm actions to the shared footer, keeping a proper associated form. Leave contextual thread controls in the body where appropriate.

### R02 — Some custom editable fields use 15px text
**Priority: Medium. Evidence: Source-backed; iOS behavior unverified.**

`src/styles.css:151` (`.field-textarea`), `789` (`.gw-input`) and `920` (`.as-input`) set editable text to 15px. This can trigger focus zoom on iOS and change the visible composition. Standard Input and Textarea already use 16px on mobile, so the issue is in custom overrides, not every form.

**Correction:** Keep editable phone text at least 16px and test real iOS focus/blur. Do not claim custom non-input SelectTrigger buttons automatically trigger keyboard zoom; that was not demonstrated.

### R03 — Four check-in counters remain dense at phone width
**Priority: Medium. Evidence: Source-only risk.**

`src/styles.css:494–495` uses four columns at all sizes. Spanish labels, especially waitlist labels, have limited room. Labels are allowed to wrap; this is **not** proof they overlap.

**Correction:** Test actual crowded check-in data in Spanish at 375px. If readability is poor, use a 2×2 arrangement on narrow phones while keeping all counts visible.

### R04 — Some choice and schedule grids need long-content checks
**Priority: Low/Medium. Evidence: Source-only risk.**

- Generic choice pairs/triples: `src/styles.css:90–94,612`.
- Location schedule: `src/styles.css:1899`, with a fixed 6.5rem column and 44px action column.
- Location paired fields: `src/styles.css:1900`.

The offer-type selector already has a later auto-fit override at `1148`; it should not be reported broken based only on the initial generic two-column rule. Location fields and badge choices still need populated Spanish and long-name checks.

### R05 — Raw Create drawer and very long content
**Priority: Low/Medium. Evidence: Source-only risk.**

`src/components/gatherwell-shell.tsx:72–75` uses a raw drawer rather than the shared header/body/footer frame. The creation options have an explicit 80px minimum and are not undersized. However, leader-template content plus four options should be checked on short phones to ensure all content remains reachable.

The assistant intentionally uses a different drawer/panel layout. That distinction is not itself a bug.

### R06 — Content agreement is not enforced by mobile alignment checks
**Priority: Review item, not a new layout bug.**

The tested published event displays “3:00 PM–4:00 PM UTC” while the location/description text mentions “9am.” This is real stored content, not invented audit content. Its text fits, but the information may confuse a guest. Verify the event's intended timezone and supplied time before editing it. The audit did not change it.

## 5. What passed

### Main public screens
Home, Discover, Hosts, Pricing, Studios and Login stayed within the viewport at **375/390/414px** in both languages after content loaded. The tested headings, page buttons and section layouts did not visibly overlap.

### Public menu
- English and Spanish menus fit at 375px.
- Menu fits at 667px and 568px heights, although the bottom action becomes too short at 568px.
- Links remain readable; Spanish wraps onto two lines where needed.
- Keyboard focus stayed inside the open menu.
- Escape closed it and restored focus to the menu trigger.

### Discover and sample gathering
- Weekend filter stayed within the viewport.
- Category row intentionally scrolls sideways **inside its container**; offscreen categories are not whole-page overflow.
- Card title opens the sample preview sheet.
- Sample RSVP shows preview feedback rather than creating a real registration.
- Sample preview header, explanatory text and full-width action align correctly.
- Preview footer remains visible in the tested phone state.
- Dark preview and reduced-motion state render correctly in the tested scope.

### Public guest RSVP
A real published public event opened and its RSVP form was exercised with sample names but **without submitting contact information or creating an RSVP**.
- Labels, two-column name fields, phone/email, plus-one controls, bilingual consent wording and confirmation action fit at 375/390/414px.
- Missing-contact validation appears correctly in both languages.
- Name fields scroll their long input text internally; that is normal input behavior, not page overflow.
- The SMS terms link remains visible in the Spanish consent paragraph.
- Inputs are 16px text, avoiding the custom 15px-field risk in this tested form.

### Follow popup
- Public host Follow opens the email sheet in both languages.
- Header, email label, explanation and full-width footer action fit at 375/390/414px and 667px height.
- Submit stays disabled with an empty email.
- No actual following or email sending was performed.
- Remaining issue is the short 36px field, not sheet overlap.

### Shared sheet corrections already present
The current implementation already has:
- Scrollable `.sheet-body`, `min-height:0`, and safe-area-aware footers.
- Assistant composer bottom safe-area padding.
- Create button z-index above the bottom nav and a bottom safe-area offset.
- Explicit creation-option minimum height.

These were checked against later CSS overrides. Earlier suspicious definitions alone were **not** counted as current bugs.

## 6. Coverage register

| Area | Browser coverage | Remaining gap |
|---|---|---|
| Home / Discover / Hosts / Pricing / Studios / Login | 375/390/414, EN/ES | All dynamic/live content combinations; full dark sweep |
| Terms / Privacy / Credits / Host / Guest / SMS / Cookie notices | 375, EN/ES | Wider-phone and dark full-page editorial review |
| Missing host/team/location pages | 375, EN/ES | Confirmed Spanish overflow; retest after correction |
| Missing guest/invite/referral/manage-RSVP/email-preference pages | 375, EN/ES | Valid invite/token outcomes |
| Real public host and team | 375/390/414, EN/ES in selected checks | Photo avatar, long names/bio, populated event lists |
| Published public gathering | 375/390/414, EN/ES | Paid, waitlist, waiver, buddy, team registration, retreat variants |
| Guest RSVP form | Populated names + empty-contact validation, EN/ES | Successful registration/readback intentionally not run |
| Follow sheet | 375/390/414, EN/ES | Actual submit + notification delivery |
| Sample preview / sample RSVP | EN/ES; selected dark/reduced-motion | Larger-content and physical keyboard states |
| Me / profile editing / crop / calendar | Source-reviewed | Authenticated visual and save-flow checks |
| Home dashboard / Team / Learn / member details | Source-reviewed | Authenticated populated-state checks |
| Gathering editor / quick start / offers / locations / plans / earnings | Source-reviewed | Authenticated actual input/save/display checks |
| Check-in / guest management / admin / Day 60 | Source-reviewed | Authenticated populated phone screens |
| Physical keyboard / notch / weak connection | Not exercised here | Actual iOS/Android and connection test |

### Why signed-in coverage is incomplete
The preview is signed out, and the managed account check found no app account matching the requesting user's email. The audit did not pick someone else's account or bypass authentication. An authorized signed-in preview is required to complete the visual review of private screens.

No location or published offer rows were available for a real public location/Circle page review in this run. Their unavailable states were tested and their layout implementation reviewed; those are not substitutes for populated live pages.

## 7. Overlap and consistency conclusion

The tested major public screens are mostly synchronized: shared navigation, button treatment, feature tiles, page spacing and sheet framing match. I did **not** find evidence of duplicated competing navigations or visible overlapping headings on those states.

The actual remaining consistency problems are:
1. Horizontal action-bearing empty states that fail in Spanish.
2. Mixed tap/input sizes and a shrinking compact-menu action.
3. Inconsistent use of fixed sheet footers.
4. A narrow initials avatar fallback.
5. Unverified dense signed-in grids, keyboard states and full live-content combinations.

This does **not** establish that every private form or popup is clean. Source inspection and 42 passing tests cannot provide that guarantee.

## 8. Recommended correction order

### First — confirmed mobile defects
1. Repair the shared action-bearing empty state once; retest missing host/team/location in both languages.
2. Set shared mobile input minimums and fix the Follow field through that shared rule.
3. Expand chip, language and footer hit areas; prevent compact-menu actions shrinking.
4. Stabilize public initials avatar geometry.

### Second — private-screen consistency
5. Standardize footer placement in discussion, announcement, recognition and deletion sheets.
6. Check custom 15px editable fields on real iOS.
7. Review check-in counters, schedule/choice grids and long Spanish names with real authorized data.
8. Check assistant, crop, calendar feed, profile editing and quick start with the phone keyboard open.

### Final sign-off
9. Repeat all three widths in both languages after fixes, including dark mode.
10. Verify every private primary action with the resulting state read back through the UI.
11. Test iOS/Android safe areas and weak-connection recovery separately.

## 9. Evidence and verification

Screenshot appendix in the PDF shows:
- Spanish missing-location clipping.
- Narrow public host initials fallback.
- Follow sheet alignment and short input.
- Guest form with long sample name.
- Compact Spanish menu.
- Dark sample preview.

Underlying browser measurements and screenshots are retained in the audit workspace. The latest observed preview build log was **build OK**; all **42 tests** passed in **7 test files**. No app code, prices, permissions or stored user content changed during this audit.

**Bottom line:** Fix the confirmed issues first. The public experience is largely aligned, but a complete mobile approval still requires authorized private-screen testing and physical phone checks.
