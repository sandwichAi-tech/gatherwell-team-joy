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

## Gatherwell architecture
- Marketing icons use the shared GwIcon marketing variant: duotone silhouettes with scoped contour reinforcement, preserving signed-in icon weights.
- Keep enduring product requirements in PROJECT_RULES.md; apply them to all future work.
- Use react-i18next with matched English and Latin American Spanish JSON resources for all visible and accessible copy, so language changes stay instant and complete.
- Keep shared navigation, settings, and sheets in GatherwellShell around the root Outlet; use separate leaf routes for the five tabs so deep links work.
- localStorage holds only language, theme and a pending invite code (cleared once the join completes); all user data lives in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only; the only service worker is public/push-sw.js (push display + click, no caching), registered only after the person turns push on, because offline use was not requested.
- DESIGN_RULES.md is authoritative for visuals and tone over PROJECT_RULES.md, so the permanent premium reset supersedes the initial shell design.
- Keep bilingual sample dashboard content and detail sheets frontend-only, with session state rather than stored user data, so previews never imply connected services.
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
- All AI (assistant + src/lib/ai/*, smart.functions.ts) runs server-side via Claude, model in assistant/config.ts; no key → preview text, not counted. Cards act on confirm.
- Plans/limits live in billing_accounts, team_licenses, license_seats; effective_plan()+plan_limits() decide limits (triggers, new rows only). Stripe: billing.functions.ts + /api/public/stripe/webhook only; no key → sheet.
- Platform admin: /admin data and actions go only through src/lib/admin.functions.ts and every action writes admin_audit; reports come from report_content() or the claims trigger.
- Follows/calendar: public pages read only via get_public_host/get_public_team; iCal via /api/public/calendar/$token (token is the only credential).

- ResponsiveSheet owns the fixed header/footer and scrollable body; callers pass primary actions via footer to keep them reachable.
- Guest RSVP uses a single selected contact field and optional name/guest details; normalize reminder consent against supplied destinations to preserve explicit opt-ins when fields are cleared.
- Profile and offer covers use uploader-owned private media paths and the shared crop input; public host covers are signed server-side only after resolving the host slug, never from caller-supplied paths.
- Day-60 scoreboard: raw counts come only from admin_day60(); targets and the go/adjust/rethink verdict are evaluated in src/lib/day60.ts so thresholds live in one tested place.
