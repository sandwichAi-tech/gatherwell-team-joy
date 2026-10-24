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
- Keep shared navigation, settings, and sheets in GatherwellShell around the root Outlet; use separate leaf routes for the five tabs so deep links work.
- localStorage holds only language, theme and a pending invite code (cleared once the join completes); all user data lives in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only; the only service worker is public/push-sw.js (push display + click, no caching), registered only after the person turns push on, because offline use was not requested.
- Visual rules live in DESIGN_RULES.md's active Blueprint v4 section; its historical sections are not active.
- App screens live under _authenticated/_app: the _authenticated gate redirects signed-out visitors to /login, and the _app layout sends anyone not onboarded (or holding a pending invite) to /onboarding before rendering GatherwellShell.
- Public pages (marketing + GuestShell routes /e, /h, /l, /t, /i, /r) server-render in English and call applySavedLanguage() after hydration; route loaders prefetch public data via prefetchPublic() and the router dehydrates the query cache, so crawlers and link previews see content. Render must stay window-free and deterministic (no Math.random/location in render). AuthFrame surfaces (/login, /join, /terms, /privacy) still use ClientOnly.
- Uploaded photos go to the private media bucket under the uploader's folder and are shown via signed URLs, because public buckets are blocked.
- Event detail lives at /event/$id inside the app shell; the public guest page stays at /e/$id.
- Signed-out visitors may call only guest RPCs (public event/price, RSVP by code, polls, invites, email prefs by token); all else needs sign-in + team role, as the guest page is the only anonymous surface.
- Event photos live in the private event-photos bucket and are uploaded/listed only through event-day server functions (host via bearer, guests via checked-in checkin_code), with signed URLs.
- All outbound messages go through notification_outbox and are sent only by src/lib/notify/process.server.ts via /api/public/outbox/process (token from app_config, every 5 min); a missing provider secret marks rows 'simulated', so turning a channel on needs only its secrets.
- Provider webhooks live under /api/public/{sms/inbound,email/resend,email/mailgun}, verify signatures, and return 503 until their secrets exist.
- Icons render only through GwIcon (src/components/gw-icon.tsx, Phosphor); src/components/icons.tsx re-exports named wrappers so call sites stay simple and nothing imports an icon library directly.
- Photos render only through BrandImage and come from site_media slots (private site-media bucket, signed URLs, anonymous read); only user_roles admins (has_role) can edit them at /admin/site-media.
- Communications hub (/communications) writes only via 0095 RPCs into notification_outbox; email/SMS activation blocked until provider secrets exist.
- All AI (assistant + src/lib/ai/*, smart.functions.ts) runs server-side via Claude, model in assistant/config.ts; no key → preview text, not counted. Cards act on confirm.
- Plans/limits live in billing_accounts, team_licenses, license_seats; effective_plan()+plan_limits() decide limits (triggers, new rows only). Stripe: billing.functions.ts + /api/public/stripe/webhook only; no key → sheet.
- Platform admin: /admin data and actions go only through src/lib/admin.functions.ts and every action writes admin_audit; reports come from report_content() or the claims trigger.
- Platform safety uses caller-scoped admin_safety RPCs (bounded, throttled, atomic, audited); bans stay a managed-auth operation and never imply deletion.
- Account restrictions commit via service-only RPC after caller validation; managed-auth failures use checked compensation (Auth and DB writes share no transaction).
- Admin retries use admin_retry_message() (atomic requeue + audit); delivery stays in the outbox processor.
- Follows/calendar: public pages read only via get_public_host/get_public_team; iCal via /api/public/calendar/$token (token is the only credential).

- ResponsiveSheet owns header/footer/scroll body; pass primary actions via footer.
- Guest RSVP uses a single selected contact field and optional name/guest details; normalize reminder consent against supplied destinations to preserve explicit opt-ins when fields are cleared.
- Profile and offer covers use uploader-owned private media paths and the shared crop input; public host covers are signed server-side only after resolving the host slug, never from caller-supplied paths.
- Day-60 scoreboard: raw counts come only from admin_day60(); targets and the go/adjust/rethink verdict are evaluated in src/lib/day60.ts so thresholds live in one tested place.
- Parked features are gated by feature_* flags via src/lib/feature-flags.tsx; admins always see them and off routes throw notFound, so launch scope changes from /admin?tab=flags.
- Resources reuses /learn routes and the feature_learn gate; reader lists omit zero-lesson tracks and empty sections while management retains them. Authoring is type-first: /learn/create?type=… (src/lib/create-resource.ts) routes into the existing track/lesson, offer, quiz and recipe editors with presets — no second authoring backend.
- Home’s morning brief reuses getDailyBrief with authenticated caller-scoped reads and a tested pure rule mapper; no AI/daily snapshot storage, guest contacts, or shared user cache, so facts refresh and attendee codes remain private.
- Admin password sign-in uses the public /admin-login page and existing Cloud Auth accounts; getAdminAccess validates the authenticated role before navigation, while every admin data handler retains its own role check, so the sign-in screen never grants privileges.
- Event Blueprints reuse templates, TemplateEditor and the template-attributed event creation path; blueprint-defaults maps reusable fields and excludes dates/places; host-own RLS keeps drafts private.
- Platform fees are calculated only from versioned fee_rules (DB calc_platform_fee_cents, mirrored and tested in src/lib/fees.ts); orders snapshot the rule so history never recalculates.
- Database role regressions live in tests/database and run only by explicit invocation against a disposable copy; never connect these fixture-writing tests to production, preview, or the ordinary automated suite.
- Consent acceptances resolve version/hash in database triggers, and flag changes append server-owned config history; clients never choose snapshots or write audit history.
- Identity: one auth user = one profile; return paths go only through src/lib/return-to.ts (mirrored by is_safe_return_path) and emailed links use single-use auth_intents; 18+ is attested via confirm_adult() and enforced by triggers/checkout functions; view_mode is display-only; guest rows are linked only by claim_guest_records() with merges kept for audit.

- Pricing guidance lives in WhichPlan; no capability tables (features are shared).
- Resource templates (team_id null = starter) copy only via use/save_resource_template RPCs into existing content as drafts; no parallel system.
