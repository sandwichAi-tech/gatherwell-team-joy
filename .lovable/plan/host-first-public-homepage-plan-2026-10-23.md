# Host-first public homepage (/) — plan

Base: commit ede46f0. Preserve the signed-in host dashboard/layout work and the recent compact steps/tools density. Changes are limited to the public homepage, its header, copy, and tests. No schema changes expected.

## 1. Audit of current homepage (src/components/landing/landing-page.tsx)

Current order: Hero → HowItWorks (4 steps) → HostTools (15 rows) → CategoryRow → ThisWeek feed → WhoItsFor → HostBand → LeadersBand → Testimonials.

| Section | Decision | Reason |
|---|---|---|
| Hero | Keep structure, rewrite copy/CTAs | Needs Blueprint v4 headline; hero visual currently falls back to sample cards on preview hosts — switch to supplied brand photo when no real events |
| Social proof line ("N showed up") | Remove | Counts on a marketing page read as unverified claims |
| HowItWorks | Keep, rewrite to Create → Share or sell → Run or teach → Learn and grow | Already compact |
| HostTools (15 flat rows) | Replace with 6 outcome groups | Removes the repetitive wall |
| CategoryRow + ThisWeek | Merge into one "Explore" discovery section | Real data only; honest empty state |
| WhoItsFor | Replace with Audience strip | Remove any MLM/team-leader framing |
| HostBand | Remove | Repeats hero CTA |
| LeadersBand | Remove | Team-leader identity is not public positioning; teams are covered under Grow and manage |
| Testimonials | Remove from homepage | No fake/unverified quotes; data path stays for later |
| StickyFindBar | Replace with a sticky "Start hosting" bar on phones only after hero scrolls out | Host-first conversion |

## 2. New section structure and copy (EN / ES)

1. Header (landing-chrome.tsx): official BrandLogo · For Hosts (/hosts) · Tools (#tools on /) · Pricing (/pricing) · Explore (/discover) · Sign in (/login) · Start hosting (/login?intent=host, primary) · EN/ES toggle. Mobile: logo + Start hosting + menu sheet (existing focus trap) with all links and language.
2. Hero
   - Label: "Life is better together." / "La vida es mejor juntos."
   - H1: "Host events, courses, retreats, and communities—all in one place." / "Organiza eventos, cursos, retiros y comunidades, todo en un solo lugar."
   - Lede: "ZoheeWell helps you create, sell, invite, run, teach, and grow—with one simple account." / "ZoheeWell te ayuda a crear, vender, invitar, operar, enseñar y crecer, con una sola cuenta."
   - CTAs: Start hosting → /login?intent=host · Explore ZoheeWell → /discover
   - Visual: supplied site_media hero photo via BrandImage; real upcoming event cards only when present.
3. Host toolkit (id="tools"): heading "Everything you need to host" / "Todo lo que necesitas para organizar". Six outcome cards, each title + one-line summary + short inline list (no per-feature cards); on phones an accordion-style disclosure (native details/summary, keyboard-accessible).
   - Create / Crear — one-time and recurring events, retreats, virtual and hybrid.
   - Sell / Vender — tickets, tiers, add-ons, promo codes, courses, resources, memberships, subscriptions.
   - Invite and communicate / Invitar y comunicar — links, QR, email, paid SMS, reminders, updates.
   - Run / Operar — capacity, waitlists, waivers, guardian consent, check-in, Wallet tickets, attendance.
   - Teach and share / Enseñar y compartir — sections, lessons, video/embed/files/text, quizzes, progress, certificates, downloads.
   - Grow and manage / Crecer y administrar — public host profile, teams and roles, analytics, payouts, exports, moderation, support.
   - Items not yet live carry a small "Coming soon" / "Próximamente" tag (see section 6). No checkmarks implying availability.
4. How hosting works: Create → Share or sell → Run or teach → Learn and grow (Crear → Compartir o vender → Operar o enseñar → Aprender y crecer), one line each.
5. Who hosts on ZoheeWell / Quiénes organizan en ZoheeWell: wellness professionals, coaches, educators, fitness leaders, retreat organizers, creators, community organizations — single wrapped chip row, no photos of fake people.
6. For attendees and learners / Para asistentes y estudiantes: discover, register or purchase, manage tickets, learn, download resources, join memberships, return to saved experiences — compact 2-column list + link "Explore events and learning" → /discover.
7. Explore (real discovery): up to 6 upcoming cards + "See all" → /discover. Empty state: "Events are coming soon to your area" / "Pronto habrá eventos en tu zona" with Notify me, Invite a host, Create an event.
8. Pricing summary: five plans in a horizontal scroll on phones, row on desktop; "Annual billing: two months free"; "Pricing may change after the pilot"; "5% ZoheeWell platform fee on paid sales you make. Free offerings have no fee. Stripe processing is separate."; founding-host note (by personal invitation: six months complete access, no card, no automatic conversion, 30 days' notice, 20% off first paid annual year, not combined with the annual discount). Link → /pricing.
9. Trust and support: privacy (minimum data, hosts see only their participants, never sold), English and Spanish, accessibility, clear consent, host support vs. platform support, honest setup states.
10. Final split CTA: Start hosting / Explore events and learning.

## 3. Real-data rules and destinations

- Homepage discovery uses list_public_gatherings with `_include_samples: false` always on / (today it includes samples on preview hosts). Real rows already require status='published' AND visibility='public' and upcoming time.
- Additional client guard in a pure tested filter `homepageOfferings()`: drop isSample, drop rows with a test/fixture marker if present, drop past events. Courses/resources/memberships shown only if an existing public listed read exists; otherwise the section shows events only (no new RPC unless already present — to confirm during build).
- Hero never renders sample cards; falls back to the brand photo.
- Empty-state actions: Notify me → /login?next=/discover&intent=notify (reuses follow/notify path if present, otherwise sign-in then /discover; no claim that a notification is scheduled); Invite a host → native share / copy of /hosts link; Create an event → /login?intent=host.
- All next paths go through src/lib/return-to.ts.

## 4. Mobile behavior

Phone-first single column at 360–430px; 48px primary targets; toolkit as disclosures; pricing horizontal scroll with snap and visible focus; sticky Start hosting bar after hero (hidden when menu open, respects safe-area); 200% zoom without horizontal scroll; prefers-reduced-motion disables hero animation (LiveStack) and smooth scroll.

## 5. SEO

Update `landing.meta.homeTitle/home` (EN; SSR English) to host-first copy; keep og:type/twitter:card and site_media og image. Add Organization + WebSite JSON-LD only — no AggregateRating, Review, or offer counts.

## 6. Built now vs. provider-dependent (never presented as live)

Built now: entire page, copy, real discovery and empty state, routing, pricing display, language toggle.
Tagged "Coming soon" or "Setup required" until verified: paid SMS, Apple/Google Wallet, Stripe Connect payouts and paid checkout (sandbox stalled), email delivery at scale, analytics exports if not shipped. Final list confirmed against FEATURE_INVENTORY.md during build.

## Technical details

Files expected to change:
- src/components/landing/landing-page.tsx (rewrite sections)
- src/components/landing/landing-chrome.tsx (header links, mobile sticky host bar)
- src/components/landing/marketing-pages.tsx (retire WhoItsFor use on home)
- src/lib/landing.ts (no samples on home; `homepageOfferings` filter)
- src/lib/homepage.ts (new: toolkit groups, plan list from the existing pricing source, availability tags)
- src/locales/en.json, src/locales/es.json (new `home.*` keys; remove dead landing keys)
- src/routes/index.tsx (head copy, JSON-LD)
- src/styles.css (scoped gw-home-* rules only)
- CHANGELOG.md, FEATURE_INVENTORY.md, roadmap.md, mem://design/homepage-density

Tests (vitest):
- homepage.test.ts: samples/past/non-public excluded; empty list → empty state; plan prices exactly 0/49/99/199/499; fee text is 5%; no "7%", "2%", "0.49", "3%" strings in en/es home keys.
- locale-parity.test.ts already covers new keys and interpolation.
- CTA routing: Start hosting → /login?intent=host, Explore → /discover, all next values pass isSafeReturnPath.
- Playwright (no credentials) at 360, 390, 768, 1440 and 200% zoom, EN and ES: no horizontal overflow, single h1, landmark/heading order, keyboard tab order through header, menu sheet, toolkit disclosures and CTAs with visible focus, reduced-motion check, empty discovery state, no runtime errors.
- Full suite + build must pass; row counts unchanged (no data writes).
