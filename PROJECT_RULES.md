# ZoheeWell project rules — Blueprint v4 (active)

Authority and change control: see SOURCE_OF_TRUTH.md. These rules restate the approved Project Knowledge; if they differ, Project Knowledge and Blueprint v4 win.

## Product
- ZoheeWell is a mobile-first platform for events, courses, resources, host memberships and community relationships, for wellness hosts, coaches, educators, creators, fitness professionals and community organizers.
- MLM and direct-selling relationships are an initial acquisition channel, not the public identity. No insider MLM language.
- "Event" is the visible noun (never "gathering"; internal route/table names may stay).
- One account can attend and learn, host and teach, and join multiple teams.

## Beta scope (complete; stages sequence work but do not defer features)
One-time and recurring events, multi-day retreats, tickets, promotions, waitlists, waivers, guardian consent, QR check-in, Apple and Google Wallet, courses, sections, lessons, quizzes, progress, certificates, standalone resources, one-time purchases, host memberships, course subscriptions, teams, discovery, invitations, email, paid SMS, analytics, moderation, English, Spanish, accessibility and support.

## Explicit exclusions
No public ratings or reviews, participant direct messages, social feed, independent minor accounts, native video or livestream platform, travel booking, automatic host-content translation, MLM downline integration, ticket resale or transfer, paid discovery ranking, or autonomous AI publication, messaging or calling.

## Languages
English and natural Latin American Spanish both launch in beta. Every interface, validation, checkout, consent and transactional message has matched en/es keys. Host content is never auto-translated.

## Commerce
- Host is seller and merchant of record through Stripe connected accounts.
- Flat 5% ZoheeWell platform fee on every paid host-generated event, course, resource, membership and course subscription, on every plan including Pro. Free products have no fee. Stripe processing is separate.
- The old 7% / 2% / 0% ladder, monthly fee caps and the 3% + $0.49 guest fee are retired for future pricing.
- Planned monthly plans: Free $0, Advanced $49, Pro $99, Team 25 $199, Team 100 $499. Annual billing = two months free. Pricing may change after the pilot (with approval).
- Founding hosts (personally invited only): six months of complete access from activation, no card, no automatic conversion, 30 days' notice before expiry, 20% off the first paid year if annual is chosen by the end of access; not stackable with the normal annual discount.

## Privacy and trust
- Collect minimum data. A host or assigned manager sees only participants of offerings they manage; team leadership alone never reveals attendee contacts.
- Never sell personal data or infer sensitive traits. No health data by default.
- Separate, unchecked host marketing email and SMS consent; transactional messages only for fulfillment and account needs.
- Accounts, hosts, purchasers and subscribers are 18+. An adult may register a minor for an eligible event with separate guardian consent.

## Content and AI
- No unsupported health, disease, weight-loss, safety or income claims. Require endorsement and distributor relationship disclosures.
- AI may draft event copy, course outlines, summaries, quiz questions, emails and Spanish drafts; a host approves before publication or sending. No diagnosis, treatment, sensitive inference or autonomous calls.

## Engineering
- Preserve working infrastructure; map approved concepts to the existing schema before adding tables.
- Reversible migrations, RLS on every private table, server validation, idempotent provider webhooks, versioned money and consent rules, private storage, signed file access, audit logs.
- Client state never establishes payment, entitlement, permission, consent or attendance. Secrets stay server-side.
- Never present a simulated email, SMS, payment, wallet pass or AI action as completed. Screens show real data or honest empty states, never sample activity.

## Quality (every change)
Phone-first, 48px primary targets, WCAG 2.2 AA, tests, two-account data-isolation check, mobile and desktop review, accessibility review, CHANGELOG.md entry (version, date, changed, tested, unverified).


---

# Historical record — pre Blueprint v4 rules (not active)

> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# ZoheeWell rules (October 2026) — these override older sections
- Product: ZoheeWell is the event and resource platform for wellness hosts, built first for wellness MLM distributors and their teams. Like Eventbrite, but simpler and cleaner, for wellness, health and fitness.
- Four lanes, and every screen makes clear which one you're in: Events, Resources, Public host page, Attendee experience.
- One login for everyone. You become a host the moment you create something; you stay an attendee for other people's events.
- Hosts first: lead with "create an event".
- Brand: name ZoheeWell; tagline "Life is better together."; Noto Sans; Deep Plum #35263F, Soft Peach #F4C7A1, Cloud #F7F0F0, Mist #E8E3EC; supplied Adobe Terracotta logo on light, Warm Ivory on dark (BrandLogo). No emoji. Mobile first; 48px touch targets; clear pressed, selected, busy, empty and error states.
- Display is English for now (SPANISH_ENABLED stays false), but every new string gets both en.json and es.json entries.
- Visible word is "Event". Keep internal names like gathering-form and /gathering/new.
- Safe modes: Stripe, Resend, Mailgun and Twilio stay in their existing simulated / "not connected" paths until the owner says otherwise. Never show a simulated message as sent or a test payment as real.
- Guardrails for MLM hosts (strictest common rule across companies): no product sales through ZoheeWell (an external Shop link is fine); no health, weight-loss or income claims; Team resources and team-only events are always free; only Customer resources and events open to the public can be paid; referral rewards never pay between people in the same team hierarchy and never apply to team-only events; recognition is for showing up and contributing, never sales or recruiting.
- Data: a host's attendee list belongs to that host; leaders see counts and activity, never guests' contact details; we never sell or share data.
- Admin dashboard work waits until the host and attendee flows are done.
- After every change, add a CHANGELOG.md entry: version, date, what changed, what was tested, what's unverified.

DESIGN RESET: DESIGN_RULES.md replaces all earlier visual, typography, layout, sample-content and tone instructions below. Preserve the product, safety, bilingual and frontend-only requirements.

PROJECT RULES (keep these for the whole project):

APP: Gatherwell — a bilingual (English + Latin American Spanish), mobile-first app where wellness team leaders and their team members organize gatherings: fit camps, wellness nights, walking clubs, trainings, challenges and team events. Simple, warm, fun, and fast.

PEOPLE:
- Leader: owns a Team Space, can have sub-teams below, publishes templates and trainings.
- Host: creates and runs events for their team.
- Member: belongs to a team, joins events, trainings and challenges.
- Guest: RSVPs to an event through a link with no account.
- Admin: platform staff.

PRINCIPLE: Every feature should help people feel connected, confident, and that it's simple — never pressure, fear or false promises.

RULES (never break these):
1. Mobile-first. Design every screen for a phone held in one hand first. Minimum 48px tap targets. Desktop is secondary.
2. Every user-facing word goes through i18n with English and Spanish. Spanish is natural Latin American Spanish, never stiff.
3. Three taps to anything. No screen should need instructions.
4. No physical product catalog. Hosts may sell their own services (gathering tickets, challenges, memberships, courses, digital downloads) through Gatherwell; a host can also add an external "Shop" link that opens in a new tab.
5. Never show product sales, team volume, commissions or income claims. Exception: hosts may see their own revenue from gathering tickets, offers and network thank-yous on Earnings and Plan. Everything else is activity only: events, RSVPs, check-ins, trainings, challenges, badges.
6. No health, medical, weight-loss or income claims in templates, sample content or AI output.
7. Never mention any outside company or brand in the app.
8. API KEYS COME LATER. No outside service keys are set up yet (Claude, Resend, Mailgun, Twilio, Stripe, Google Maps). Whenever a feature needs one, build it behind a small backend function that reads the key from Lovable Cloud secrets, and if the secret is missing, use a clear mock: log the action, return realistic sample data, and show a small "Not connected yet" note in the UI. Never block the build, never hard-code a key, and never put keys in front-end code. We will add every secret at the end and switch the mocks off.
9. Row-level security on every table. People only see data for teams they belong to (leaders also see their sub-teams).
10. Accounts are 18+. Guests can RSVP without an account.

DESIGN:
- Colors: ink #2B1E3A (text, nav), cream #FBF7F2 (background), peach #F6C9A8 (cards, highlights), mango #FF8A3D (primary buttons), vital #2FBF71 (success, check-ins, streaks), lilac #E9E3F5 (chips, secondary surfaces). Dark mode uses deep plum backgrounds.
- Font: Plus Jakarta Sans. Big headings, generous spacing, rounded 16–24px corners, soft shadows.
- Photo-first cards. Every event has a cover image.
- Delightful motion: confetti on milestones, live counters, streak flames. Keep it fast.
- Use shadcn/ui components and lucide icons.

NAVIGATION: bottom tabs Home, Events, Team, Learn, Me. Floating mango "+" button (create). Sparkle button opens the AI assistant.

TONE: warm, energetic, short. Words: team, host, guest, gathering, win, celebrate, "your people". Light emoji. No corporate or technical jargon.


NOW BUILD THIS:

Build the Gatherwell app shell using the rules and design above. Front end only, no backend yet.

1. Layout
- Mobile: bottom tab bar with Home, Events, Team, Learn, Me (lucide icons + labels). Active tab in mango.
- Desktop (over 1024px): same five items as a left sidebar; content max width 720px centered.
- Floating mango "+" button above the tab bar. Tapping it opens a bottom sheet: New event, Announcement, Challenge, Training.
- A small sparkle button in the top-right header of every screen. It opens an empty "Assistant" bottom sheet for now.

2. Theme
- Tailwind theme tokens for ink, cream, peach, mango, vital, lilac. Plus Jakarta Sans from Google Fonts.
- Light and dark mode (follow system, with a toggle stored in localStorage).
- Rounded 20px cards, soft shadows, 48px minimum tap targets.

3. Language
- Set up react-i18next with en.json and es.json. Detect browser language on first visit; a toggle in Me switches instantly.
- Every string in this prompt goes into both files.

4. Screens (placeholders with beautiful empty states)
- Home: greeting "Good morning, {name}" and an empty "Do this next" card.
- Events, Team, Learn, Me: friendly illustration, one sentence, one mango button.

5. PWA
- Web app manifest, icons (a plum rounded square with a peach "g"), cream splash, standalone display, so it installs to a phone home screen.

Smooth page transitions. Keep the bundle light.
ADDENDUM (Oct 2026, confirmed rules — additive, nothing above removed):
- Mobile-first with 44–48px tap targets. Every user-facing word in English and Latin American Spanish via i18n.
- No physical product catalog; host services (tickets, memberships, courses, downloads) are allowed; external "Shop" link optional.
- Never show product sales, team volume, commissions or income claims (hosts' own ticket/offer/thank-you revenue on Earnings and Plan is allowed; approved 2026-10-25 referral exception below). Otherwise activity only: events, RSVPs, check-ins, trainings, challenges, badges.
- No health, medical, weight-loss or income claims anywhere.
- Never mention any outside company or brand in the app.
- API keys come later: any feature needing an outside service (Claude, Resend, Mailgun, Twilio, Stripe, Google Maps) goes in a backend function that reads the key from Lovable Cloud secrets; if the key is missing, use a realistic mock and a small "Not connected yet" note. Never hard-code keys or put them in front-end code.
- Row-level security on every table. Accounts are 18+. Guests can RSVP without an account.
- Pricing: Free $0 + 7% of paid sales (no cap); Advanced $49/month + 2%; Pro $99/month + 0%. Service fee 3% + $0.49 on every card payment. New hosts get 30 days with no limits. Numbers live in plan_settings.
- The paid community feature is called Circles. Its display name lives in one translation key (feature_name_singular / feature_name_plural).
- Locations: Gatherwell never runs a front desk or sells products for a location; "Book a class" and "Our store" only link out.
- Guest service fee: 3% + $0.49 on paid single tickets only (never free RSVPs or subscriptions); a coach can cover it per gathering. Numbers live in plan_settings.
- Founding coaches (max 6): Pro free for 6 months from one shared start date, then $49/month locked while on Pro. Non-cash, never tied to recruiting.
- Every host gets their own space by default; a team is optional.
- One app, one login, two homes: customers (role_intent 'guest') and hosts. Me has 'Start hosting' and 'Switch to attending'.
- Signed-in screens never show sample or demo data. Show real numbers or hide the block.

## Launch mode
Launch mode: the app shows only what serves three jobs. Leader: see the organization's week and help hosts run what works. Host: fill gatherings and follow up. Guest: get there easily and feel welcome. Everything else stays behind a feature flag until users ask for it.


## Referral commission exception (approved 2026-10-25, rows 56–58)
- Referral commissions may appear only (a) in the opt-in referral-program area (/referrals) to the host who owns or manages the item, and (b) in each referrer's own private earnings view (/referrals/mine).
- Never show team volume, downline income, public earnings, income claims, or another person's earnings. Referrers never see buyer identity.
- No reward for self-referrals, for the host, or when purchaser and referrer share any team relationship. Team-only events are ineligible. Free items use ordinary sharing.
- Totals stay at zero until real payments are confirmed; beta payouts are manual records only and never imply ZoheeWell moved money.
