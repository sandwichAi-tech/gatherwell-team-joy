# Resources (/learn) — pressure test and beta plan

## 1. Why the current page is confusing

Compared with /events (one heading, one create button, one tab row, one card grid, one empty state), the signed-in /learn page (`LearnHome`):

- **No tabs or filters.** It is a long stack of sections that appear or vanish depending on data: My learning list, Certificates, a "Start here" track, "Your tracks", Live sessions, Recipes. People can't tell what is missing versus what doesn't exist.
- **Recipes get top-level space.** Recipes are the only content with a "View all" link and their own route (/learn/recipes). Today the database holds 6 ZoheeWell starter recipes and 0 team recipes, so on most accounts recipes are the only thing that shows, and the page reads like a recipe app.
- **Three card styles, three systems.** Tracks use `TrackCard`, purchased courses/downloads use small `offer-row` list rows, recipes use `RecipeCard`. Nothing tells the viewer what type something is (course, PDF, video, link) or who made it.
- **Creation is hidden and split.** Only team *leaders* see a secondary "Manage Resources" button (to /learn/manage with Tracks/Recipes/Progress tabs). Courses and resource bundles are made somewhere else (/offers + content studio). Hosts who aren't leaders get no create action, unlike /events, where every non-member gets one.
- **Starter vs. own content isn't marked.** Starter recipes (no team) look the same as team content. There is no "Use this starter" action, though event blueprints already have one (`copy_starter_template`).
- **Wording doesn't match.** The eyebrow and title come from `learn.*`, the button says "Manage Resources", sections say "tracks", and the back links say "Learn".
- **Possible bug (needs a check first):** the database has 6 lessons of type `text`. The page's `LessonType` only knows video/pdf/link/live, so `TYPE_ICON['text']` is undefined, and the track page may fail to draw those rows.

## 2. Recommended structure and tabs

Keep the URL **/learn**: it's already linked everywhere, gated by `feature_learn`, and covered by return-path rules. Rename only what people see: nav label, page title, head titles and back links all become **Resources / Recursos**.

```text
Resources                                  [Starter library] [+ Create resource]
"Courses, guides and sessions from your team and ZoheeWell."
[ For you | Library | Live | Saved | Created by me* ]      (* hosts/leaders only)
[ Type: All · Courses · Videos · Audio · Guides & PDFs · Files · Links · Recipes ]
[ Source: All · My team · ZoheeWell starter ]
-- one card grid, one ResourceCard style --
-- tab-specific empty state with a next step --
```

- **For you** (default): continue-in-progress (tracks and entitled courses with progress), the "Start here" track, upcoming live sessions (next 3), and certificates as a compact link.
- **Library**: everything the person can open, in one grid, with type/source chips in the URL (`?tab=library&type=pdf&source=starter`) so links can be shared.
- **Live**: upcoming sessions (reminders, add to calendar) plus replays.
- **Saved**: saved recipes plus saved offerings (existing `saved_offerings`).
- **Created by me** (anyone who can create): drafts and published items across tracks, courses/bundles and team recipes, with status chips. Links go to the existing editors. /learn/manage stays, reached from here.
- **Create resource** opens a small chooser sheet: Course · Resource bundle (files, links, text) · Track for my team · Recipe. Each choice goes to its existing editor. Show it with the same rule as /events (`role !== 'member'`), still subject to each editor's own server checks.
- **Starter library** button: switches to Library with source=starter. Starter cards show a "ZoheeWell starter" chip and a **Use this** action for creators.

## 3. Data-to-UI mapping

| Card type (chip) | Source rows | Who sees it | Opens |
|---|---|---|---|
| Course | `offers` kind=course (status published, or entitled through My learning) + attached `tracks.offer_id` | buyers/enrolled; host | /offer/$id |
| Track | `tracks` with team_id (published, or leader drafts), only if it has lessons | team members | /learn/track/$id |
| Video / PDF / Link / Text | `lessons.type` inside readable tracks; `offer_items.type` (file/text/https/embed) inside entitled bundles | same as parent | lesson page / bundle reader |
| Audio | `offer_items` type=file with an audio file type; no lesson type exists for audio | same as parent | bundle reader with `<audio>` |
| File / download | `offers` kind=download + `offer_items` type=file | entitled | /offer/$id (signed download) |
| Live / Replay | `lessons` type=live, `live_starts_at`, `replay_url` | track readers | LiveCard / lesson |
| Quiz | `quizzes` attached to a lesson/offer: shown as a "Quiz" badge on its parent card, not as a separate card | same as parent | parent |
| Recipe | `recipes` (team_id null = ZoheeWell starter; otherwise team) | everyone / team | /learn/recipe/$id |
| Membership | `offers` kind=membership: **not** a resource. Kept in Saved/My learning only if entitled, labelled Membership | members | /offer/$id |

Source chip: `team_id IS NULL` gives "ZoheeWell starter"; a team or host owner gives "{team/host name}". Current data: 6 starter recipes, 0 starter tracks, 3 team tracks, 3 archived courses, 1 draft + 1 published membership, 6 text lessons, 0 bundle items.

## 4. Can be done now, no credentials needed

All of it. It's front end only, on existing reads: the new tabs/filters, `ResourceCard`, the create chooser, starter/source chips, renaming the visible labels, empty states, the text-lesson fix, and Saved combining recipes and offerings. Paid courses/bundles still show "Setup required" exactly as they do today.

## 5. Backend work (only where truly needed)

- **Needed, small:** "Use this" for **starter recipes**. Add an additive security-definer RPC `copy_starter_recipe(_recipe, _team)` (same pattern as `copy_starter_template`). It checks `team_capability` for content creation, copies into the caller's team as a draft, and is granted to authenticated only. It writes an audit row through the existing team_audit path.
- **Probably not needed:** a combined library RPC. The plan builds the list from the existing `learnQuery`, `myLearningQuery`, `recipesQuery`, and saved queries in the browser, so existing RLS applies. Revisit only if it gets slow.
- **Not adding:** starter tracks/courses (none exist; I won't create sample content), a new audio lesson type, or new tables.
- **Verify first:** that RLS on `offer_items` lets entitled learners list items for the Library (the existing `bundleAccessQuery` is per-offer). If it doesn't, Library shows bundles at the offer level only.

## 6. Implementation steps

1. Check and fix the `text` lesson type (icon, label, player body) and add a test.
2. Add `src/lib/resources.ts`: a pure `toResources()` mapper that turns tracks/lessons/offers/items/recipes into one `Resource` shape {id, kind, source, status, href, cover, progress, hasQuiz}, plus `filterResources(tab, type, source)`. Unit-test it.
3. Route search params on /learn: `tab`, `type`, `source` (zod with `.catch`).
4. Rewrite `LearnHome` to the events-style layout. Reuse `LiveCard`, `ProgressRing`, `LearnCover`/`OfferCover` inside one `ResourceCard`. Use `segmented role=tablist` like /events, and filter chips as `aria-pressed` buttons.
5. Add a `CreateResourceSheet` (ResponsiveSheet) with four choices that link to the existing editors.
6. Migration for `copy_starter_recipe` plus a "Use this" button. Note it in SECURITY_NOTES.
7. Visible renames: nav label, `gatherwellHead('learn')` title/description, back links, and learn-manage heading become "Resources", in EN and ES.
8. Locales: a new `resources.*` block (tabs, type chips, source chips, empty states per tab, create chooser, starter chip, use-this toasts) with matched EN and Latin American ES keys, plus the existing parity test.

**Accessibility and mobile:** 48px targets; tab row and chips scroll sideways inside their own area at 390px; cards are one column on phone and 2–3 on desktop; type is shown as icon plus text (never color alone); the type and source are spoken in each card's accessible name; focus stays on the tab when switching; empty states use `role=status`; the chooser sheet traps and restores focus; reduced motion respected.

**Tests:**
- Unit tests: `toResources` mapping per type and source, starter detection, membership exclusion, archived-course handling (entitled learners keep it, labelled archived), filters, the text lesson type.
- Two-account check: a member of team A can't see team B tracks or recipes in Library; `copy_starter_recipe` is refused for an outsider/member and works for a host; the copy is a draft in the caller's team only.
- Browser checks at 390 and 1280, EN/ES: each tab, filters in the URL, create chooser, starter "Use this", empty states, 200% zoom, no page overflow, no console errors.
- Full test suite, typecheck, build. Update CHANGELOG, FEATURE_INVENTORY and roadmap.

**Assumptions to correct if wrong:** /learn stays the URL; memberships aren't shown as resources; quizzes appear as badges on their parent, not as their own cards; non-leader hosts get the create action.
