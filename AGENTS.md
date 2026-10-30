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

Read SOURCE_OF_TRUTH.md first: Blueprint v4 governs product rules; this file covers engineering. Read supabase/AGENTS.md for that directory.

## ZoheeWell architecture (internal names such as Gatherwell*/gathering are legacy identifiers)
- BrandLogo: original CDN SVGs/theme variants; BrandImage: photos; preserve logo colors, no photo grading.
- Marketing GwIcon: duotone silhouettes/scoped contour reinforcement; preserve signed-in icon weights.
- Keep homepage hosting paths, steps and tool inventory inside the existing landing page and reuse login intent/discovery routes; marketing copy never claims a provider or checkout is live before it is verified.
- Rules: PROJECT_RULES.md under SOURCE_OF_TRUTH.md.
- All copy uses matched EN/Latin American Spanish JSON; t() literals and finite billing/marketing/progress keys are tested without fallback to catch missing text.
- GatherwellShell shares desktop/mobile tabs; insights-navigation gates own-host/team access; mobile tabs scroll.
- localStorage holds only language, theme and a pending invite code (cleared once the join completes); all user data lives in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only; the only service worker is public/push-sw.js (push display + click, no caching), registered only after the person turns push on, (offline not requested).
- Visual rules: DESIGN_RULES.md's active Blueprint v4 section only, not historical sections.
- App screens live under _authenticated/_app: the _authenticated gate redirects signed-out visitors to /login, and the _app layout sends anyone not onboarded (or holding a pending invite) to /onboarding before rendering GatherwellShell.
- Public pages (marketing + GuestShell /e /h /l /t /i /r) SSR in English, then applySavedLanguage(); loaders prefetchPublic() and the router dehydrates the cache for crawlers. Render stays window-free and deterministic. AuthFrame pages (/login, /join, /terms, /privacy) use ClientOnly.
- Uploads go to private media under the uploader's folder, shown via signed URLs (public buckets blocked).
- Host waiver/release forms: owner-only waiver_library edited only via save_host_form (immutable versions), attached/ordered via attach_library_waiver/reorder_event_host_forms, managed at /waivers; keeps one library for builder and Me.
- Event detail: app /event/$id; public /e/$id.
- Signed-out visitors may call only guest RPCs (public event/price, RSVP by code, polls, invites, email prefs by token); all else needs sign-in + team role, as the guest page is the only anonymous surface.
- Event photos live in the private event-photos bucket and are uploaded/listed only through event-day server functions (host via bearer, guests via checked-in checkin_code), with signed URLs.
- All outbound messages go via notification_outbox, sent only by src/lib/notify/process.server.ts through /api/public/outbox/process (app_config token, 5 min); missing provider secrets mark rows 'simulated', so a channel needs only its secrets.
- Provider webhooks live under /api/public/{sms/inbound,email/resend,email/mailgun}, verify signatures, and return 503 until their secrets exist.
- Icons use Phosphor via GwIcon only; icons.tsx re-exports wrappers.
- Photos render only through BrandImage and come from site_media slots (private site-media bucket, signed URLs, anonymous read); only user_roles admins (has_role) can edit them at /admin/site-media.
- Communications hub (/communications) writes only via 0095 RPCs into notification_outbox; email/SMS activation blocked until provider secrets exist.
- All AI (assistant + src/lib/ai/*, smart.functions.ts) runs server-side via Claude, model in assistant/config.ts; no key or no real source text → honest error, never sample/preview content. Cards act on confirm.
- Plans/limits live in billing_accounts, team_licenses, license_seats; effective_plan()+plan_limits() decide limits (triggers, new rows only). Stripe: billing.functions.ts + /api/public/stripe/webhook only; no key → sheet.
- Platform admin: /admin data and actions go only through src/lib/admin.functions.ts and every action writes admin_audit; reports come from report_content() or the claims trigger.
- Safety: caller-scoped admin_safety RPCs (bounded, throttled, audited); bans via managed auth, never deletion; restrictions via service-only RPC with checked compensation; retries via admin_retry_message().
- Public counts: events.public_counts enforced by mask_public_counts() in the public event/feed RPCs; staff bypass.
- Public follows use get_public_host/get_public_team; iCal token is its only credential.

- ResponsiveSheet owns header/footer/scroll body; pass primary actions via footer.
- Guest RSVP uses a single selected contact field and optional name/guest details; normalize reminder consent against supplied destinations to preserve explicit opt-ins when fields are cleared.
- Covers/add-on images reuse private uploader media and shared cropping. Sign only after resolving authorized host/event, never caller paths; add-on cleanup preserves saved references.
- Day-60 scoreboard: raw counts come only from admin_day60(); targets and the go/adjust/rethink verdict are evaluated in src/lib/day60.ts so thresholds live in one tested place.
- Parked features are gated by feature_* flags via src/lib/feature-flags.tsx; admins always see them and off routes throw notFound, so launch scope changes from /admin?tab=flags.
- Resources: /learn + feature_learn, type-first create. Destinations (Team/Coach flags + course placements as reference lessons) are written only by set_resource_destinations and read by resource_destinations; course-only items follow the course gate via resource_course_included; legacy NULL flags derive from placement. Resolve visibility before signing. Paid checkout blocked until orders/refunds verified.
- Home/brief: caller-only personal_home saved progress, auth-cleared cache; shortcuts use event-local occurrence/session days. Insights: UTC.
- Admin password sign-in: public /admin-login with existing Cloud Auth accounts; getAdminAccess checks the role before navigation and every admin handler re-checks, so sign-in never grants privileges.
- Challenges: retry-keyed atomic save_challenge_request; locked enroll_challenge; enrolled/owner private progress and leaderboard; paid checkout blocked until orders/refunds verified. Extras reuse event media; cleanup preserves Challenge references.
- Platform fees come only from versioned fee_rules (calc_platform_fee_cents, mirrored in src/lib/fees.ts); orders snapshot the rule.
- Database role regressions live in tests/database and run only by explicit invocation against a disposable copy; never connect these fixture-writing tests to production, preview, or the ordinary automated suite.
- Identity: one auth user = one profile; return paths only via src/lib/return-to.ts; emailed links use single-use auth_intents; 18+ via confirm_adult(); view_mode display-only (host-return eligibility: src/lib/host-eligibility.ts, never admin/mode); guest rows link only via claim_guest_records().

- WhichPlan guides pricing; no capability tables.
- Templates copy as drafts. Resource journeys use scoped entitlements, idempotent in-app delivery. Coach consent needs verified accounts or hashed expiring links; no sender = requests stay pending. Segments expose counts only.

- Referral attribution/rewards/status are server-owned (0119 RPCs + orders_referral_hook), mirrored in src/lib/referrals.ts; landing reuses the analytics device id.
- Profile IA: account fields edit only in Me's Edit profile, public-page fields only in HostProfilePanel (src/lib/profile-ia.ts PROFILE_FIELDS); host categories are allowed keys normalized by a DB trigger.
- Event images use share-image.ts for all outputs; admin menu uses role checks.
- Event cover category selection and display-only title casing use event-presentation.ts; default photos resolve through site_media so admin photo changes propagate without changing event records.
- usePublicSession affects navigation display only, never access.
- Course drip is decided only by lesson_unlock_at()/lesson_is_unlocked() (mirrored in src/lib/course-release.ts) and enforced by restrictive RLS on lessons, summaries and learn-media; browsers get locked titles only via my_locked_lessons().
- Event Builder partial drafts use manager-only event_builder_drafts snapshots; publish validates and writes canonical event fields, so incomplete input never becomes attendee data.
- Own QR unchanged; walk_in_admit binds event/retry and owner/assigned staff, capacity/payment/waivers; journeys dedupe. Manager-only waivers snapshot text, never rewrite acceptances.
- Owner approves joins; legacy members remain. Library reuses templates and independent allowlisted drafts, never entitlements. Channels keep direct guards and separate unread/mute.
- Event identity uses get_public_host eligibility; host waiver libraries are owner-only and published-once events lock snapshots. The ZoheeWell event agreement (consent kind event_agreement) is platform-owned: the database pins it on publish or when one is approved, never blocks hosts, never rewrites a pin, and only registration fails closed without it.
- Resource courses use lesson slots for ordered quiz/assessment/reference items, checked full-ID reorder and detach-only removal to preserve source identity/history; references keep current source access until inclusion is verified.
- Assessment completion uses immutable private assessment_receipts and approved version/hash scope references, not quiz grading/certificates; author preview never creates participant evidence.
- Challenge orders reuse the canonical ledger with expiring holds, immutable checkout parameters, checked session binding and service-only settlement/refund transitions; canonical deliveries use fenced provider_events leases so crashes can retry without client-asserted success.
- Resource removal goes only through resource_removal_plan()/remove_resource()/restore_resource(): untouched drafts are deleted, anything with placements, access, purchases or learner history is archived (unplaced, unpublished, archived_at), and guard triggers refuse signed-in deletes that would cascade history.
