<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Read SOURCE_OF_TRUTH.md first; product rules come from Blueprint v4, these are engineering conventions only. Subdirectories (supabase/) have their own AGENTS.md.

## ZoheeWell architecture (internal names such as Gatherwell*/gathering are legacy identifiers)
- Render brand artwork through BrandLogo using original CDN-backed SVGs and theme-aware variants; keep photography in BrandImage so logos retain exact supplied colors without photo grading.
- Marketing icons use the shared GwIcon marketing variant: duotone silhouettes with scoped contour reinforcement, preserving signed-in icon weights.
- Keep homepage hosting paths, steps and tool inventory inside the existing landing page and reuse login intent/discovery routes; marketing copy never claims a provider or checkout is live before it is verified.
- Keep enduring product requirements in PROJECT_RULES.md under SOURCE_OF_TRUTH.md.
- Use react-i18next with matched English and Latin American Spanish JSON resources for all visible and accessible copy, so language changes stay instant and complete.
- GatherwellShell shares desktop/mobile tabs; insights-navigation gates own-host/team access; mobile tabs scroll.
- localStorage holds only language, theme and a pending invite code (cleared once the join completes); all user data lives in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only; the only service worker is public/push-sw.js (push display + click, no caching), registered only after the person turns push on, (offline not requested).
- Visual rules live in DESIGN_RULES.md's active Blueprint v4 section; its historical sections are not active.
- App screens live under _authenticated/_app: the _authenticated gate redirects signed-out visitors to /login, and the _app layout sends anyone not onboarded (or holding a pending invite) to /onboarding before rendering GatherwellShell.
- Public pages (marketing + GuestShell /e /h /l /t /i /r) SSR in English, then applySavedLanguage(); loaders prefetchPublic() and the router dehydrates the cache for crawlers. Render stays window-free and deterministic. AuthFrame pages (/login, /join, /terms, /privacy) use ClientOnly.
- Uploaded photos go to the private media bucket under the uploader's folder and are shown via signed URLs, because public buckets are blocked.
- Event detail lives at /event/$id inside the app shell; the public guest page stays at /e/$id.
- Signed-out visitors may call only guest RPCs (public event/price, RSVP by code, polls, invites, email prefs by token); all else needs sign-in + team role, as the guest page is the only anonymous surface.
- Event photos live in the private event-photos bucket and are uploaded/listed only through event-day server functions (host via bearer, guests via checked-in checkin_code), with signed URLs.
- All outbound messages go via notification_outbox, sent only by src/lib/notify/process.server.ts through /api/public/outbox/process (app_config token, 5 min); missing provider secrets mark rows 'simulated', so a channel needs only its secrets.
- Provider webhooks live under /api/public/{sms/inbound,email/resend,email/mailgun}, verify signatures, and return 503 until their secrets exist.
- Icons render only through GwIcon (src/components/gw-icon.tsx, Phosphor); src/components/icons.tsx re-exports named wrappers so call sites stay simple and nothing imports an icon library directly.
- Photos render only through BrandImage and come from site_media slots (private site-media bucket, signed URLs, anonymous read); only user_roles admins (has_role) can edit them at /admin/site-media.
- Communications hub (/communications) writes only via 0095 RPCs into notification_outbox; email/SMS activation blocked until provider secrets exist.
- All AI (assistant + src/lib/ai/*, smart.functions.ts) runs server-side via Claude, model in assistant/config.ts; no key → preview text, not counted. Cards act on confirm.
- Plans/limits live in billing_accounts, team_licenses, license_seats; effective_plan()+plan_limits() decide limits (triggers, new rows only). Stripe: billing.functions.ts + /api/public/stripe/webhook only; no key → sheet.
- Platform admin: /admin data and actions go only through src/lib/admin.functions.ts and every action writes admin_audit; reports come from report_content() or the claims trigger.
- Safety: caller-scoped admin_safety RPCs (bounded, throttled, audited); bans via managed auth, never deletion; restrictions via service-only RPC with checked compensation; retries via admin_retry_message().
- Public follows use get_public_host/get_public_team; iCal token is its only credential.

- ResponsiveSheet owns header/footer/scroll body; pass primary actions via footer.
- Guest RSVP uses a single selected contact field and optional name/guest details; normalize reminder consent against supplied destinations to preserve explicit opt-ins when fields are cleared.
- Profile and offer covers use uploader-owned private media paths and the shared crop input; public host covers are signed server-side only after resolving the host slug, never from caller-supplied paths.
- Day-60 scoreboard: raw counts come only from admin_day60(); targets and the go/adjust/rethink verdict are evaluated in src/lib/day60.ts so thresholds live in one tested place.
- Parked features are gated by feature_* flags via src/lib/feature-flags.tsx; admins always see them and off routes throw notFound, so launch scope changes from /admin?tab=flags.
- Resources reuses /learn and the feature_learn gate; readers skip empty tracks/sections, managers keep them. Authoring is type-first via /learn/create?type=… (src/lib/create-resource.ts) into existing editors — no second authoring backend.
- Home brief: getDailyBrief, caller-scoped, no AI/shared cache. Insights compares UTC event cohorts.
- Admin password sign-in: public /admin-login with existing Cloud Auth accounts; getAdminAccess checks the role before navigation and every admin handler re-checks, so sign-in never grants privileges.
- Blueprints/challenges reuse existing editors; drafts stay private. Experience sessions use existing events and whole-event admission.
- Platform fees are calculated only from versioned fee_rules (DB calc_platform_fee_cents, mirrored and tested in src/lib/fees.ts); orders snapshot the rule so history never recalculates.
- Database role regressions live in tests/database and run only by explicit invocation against a disposable copy; never connect these fixture-writing tests to production, preview, or the ordinary automated suite.
- Consent acceptances resolve version/hash in database triggers, and flag changes append server-owned config history; clients never choose snapshots or write audit history.
- Identity: one auth user = one profile; return paths only via src/lib/return-to.ts; emailed links use single-use auth_intents; 18+ via confirm_adult(); view_mode display-only; guest rows link only via claim_guest_records().

- WhichPlan guides pricing; no capability tables.
- Templates copy as drafts. Resource journeys use scoped entitlements, idempotent in-app delivery. Coach consent needs verified accounts or hashed expiring links; no sender = requests stay pending. Segments expose counts only.

- Referral attribution/rewards/status are server-owned (0119 RPCs + orders_referral_hook), mirrored in src/lib/referrals.ts; landing reuses the analytics device id.
- Profile IA: account fields edit only in Me's Edit profile, public-page fields only in HostProfilePanel (src/lib/profile-ia.ts PROFILE_FIELDS); host categories are allowed keys normalized by a DB trigger.
- Event images use share-image.ts for all outputs; admin menu uses role checks.
- Course drip is decided only by lesson_unlock_at()/lesson_is_unlocked() (mirrored in src/lib/course-release.ts) and enforced by restrictive RLS on lessons, summaries and learn-media; browsers get locked titles only via my_locked_lessons().
- Event Builder partial drafts use manager-only event_builder_drafts snapshots; publish validates and writes canonical event fields, so incomplete input never becomes attendee data.
