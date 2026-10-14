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
- Never show product sales, team volume, commissions or income claims (hosts' own ticket/offer/thank-you revenue on Earnings and Plan is allowed). Otherwise activity only: events, RSVPs, check-ins, trainings, challenges, badges.
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
