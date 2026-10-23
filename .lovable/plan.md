# Prompt 3 — Identity, onboarding, language and account modes (plan)

Note: the sandbox HEAD is `3a664cf27e03536f09a8dd496fff1fbb1bb9d8fe`, not `8715a90…`. The build turn will diff against 8715a90 first and stop if they conflict.

## 1. Verified inventory (read this turn)
- `/login` (src/routes/login.tsx): Google via Lovable OAuth plus email magic link (`signInWithOtp`, `emailRedirectTo` = `/login?intent=host`). Only `intent=host` survives; every other destination is lost (after = `/home` or `/gathering/new`).
- `/_authenticated/route.tsx`: signed-out users redirect to `/login` with no return target.
- `/_authenticated/_app/route.tsx`: sends to `/onboarding` if not onboarded or if a pending join code is in localStorage.
- `/join/$code`: `get_team_invite` RPC, then stores the code and inviter in localStorage; signed-in users go to onboarding, which calls `join_team_by_code` and clears the keys.
- `/i/$code`, `/r/$code`, `/e/$id` (guest RSVP via `rsvp_event_full`, `?k=` token), `/l`, `/t`, `/h`, `/offer/$id`, `/admin-login`, `/verify`, `/start`.
- Onboarding steps: name, place, role (`guest|leader|host|member` saved to `profiles.role_intent`), team. Not checked: age.
- `profiles` has no age or birth-date field. `rsvps` keeps guest_name/email/phone with a nullable user_id. `orders.buyer_user_id` is nullable. `entitlements.user_id` is required. `offer_purchases.user_id` exists.
- `SPANISH_ENABLED = false` in src/lib/i18n.ts. en.json and es.json exist.

## 2. Conflicts and duplicate-identity risks
- `role_intent` acts as a lasting account type. Blueprint v4 asks for view modes instead.
- Return destinations are dropped at login, so course, resource, membership and event links fail to resume.
- If a guest verifies later, the RSVP and order stay unlinked by email. A new RSVP for the same event can be made under user_id, which creates a duplicate.
- The localStorage invite can go stale across accounts on a shared device.
- Spanish is turned off.

## 3. Schema changes (additive, reversible, one migration)
- `profiles`: add `adult_confirmed_at timestamptz` and `view_mode text default 'attending'` (values attending|hosting). Mark `role_intent` as deprecated with a comment and keep it.
- `auth_intents` table: id, token_hash, kind (event|course|resource|membership|team|offer), target_id, step, email_hash, expires_at (30 min), consumed_at. Server-only grants, RLS on, no client select.
- `claim_guest_records()` security definer: runs only on the caller's verified email (`auth.jwt()->>'email'` plus `email_confirmed_at`). It is idempotent and returns counts.
- `confirm_adult(_attest boolean)`, plus checks in `create_gathering*`, `create_team`, checkout and subscription functions that require `adult_confirmed_at`.
- Unique partial index: rsvps(event_id, user_id) where user_id is not null and status is not cancelled. A pre-check confirms there are no existing violations first.
- Rollback: drop the new function, index and table, and the columns nulled and ignored. No existing rows are rewritten.

## 4. Redirect and deep-link safety
- A single `src/lib/return-to.ts` handles `?next=`. It allows only same-origin relative paths that match a small set of routes (`/e/`, `/l/`, `/t/`, `/h/`, `/offer/`, `/learn/`, `/join/`, `/i/`, `/r/`, `/event/`, `/home`, `/gathering/new`). It rejects `//`, schemes, backslashes, encoded control characters and paths longer than 512. Anything else falls back to `/home`.
- `_authenticated` adds `?next=` on redirect. The login magic link and OAuth `redirect_uri` stay `/login?next=…`, and `next` is re-validated after sign-in. Onboarding resumes `next` when it finishes.
- Unit tests cover the allowlist and attack strings.

## 5. Guest claim and merge rules
- Claims happen only after the email is verified and only for an exact lowercase match.
- RSVPs: set user_id where it is null. If the user already has one for the same event, keep the earlier one, cancel the duplicate and move its waiver link and answers.
- Orders: set buyer_user_id where it is null. Never create new orders.
- Entitlements: create them from claimed paid orders using the idempotency key. Unique constraints stop duplicates.
- Consents and waivers: keep them as recorded and only link them. Marketing consent is never inferred.
- Subscriptions: already require an account, so nothing is claimed.
- One auth user gives one profile (existing trigger). Google and email for the same address resolve to one user under the backend's identity linking. This will be tested and reported as unverified if it can't be proven.

## 6. 18+ and guardians
- Signup, hosting, purchases and subscriptions require an unchecked "I am 18 or older" confirmation, recorded with a time and a consent version. No birth date is stored (minimum data).
- Guardian path: on eligible events (new `events.allows_minors boolean default false`), the adult registers and adds a minor's first name and age band only. A separate unchecked guardian consent is stored against the adult's RSVP. Minors never get accounts or emails.

## 7. Three starts and view modes
- After first sign-in: Find something (`/discover`), Create something (`/gathering/new` after the 18+ check), I have an invitation (code entry leading to `/join`).
- A Hosting / Attending & Learning switch in the shell and on Me saves `view_mode`. It changes the default tabs only and never changes permissions. One profile throughout, with multiple teams through the existing `active_team_id`.

## 8. Language
- Set `SPANISH_ENABLED=true` and restore the switch everywhere.
- Add matched keys for onboarding, verification, validation, consent, guardian, invitations, recovery, setup-required, and the auth and transactional email templates.
- A key-parity test makes the build fail on missing or extra keys. A 35% text-expansion check runs at 360px.

## 9. Truthful delivery
- The magic link or code says "sent" only when the auth call succeeds. Transactional messages go through the outbox. A simulated or setup-required status shows "Email delivery isn't set up yet" and never "sent". Guest one-time codes use the backend's email OTP, with no custom code system.

## 10. Tests and gates
- Vitest: return-to, key parity, claim rule mapper, 18+ gating mapper, view-mode default.
- Database: claim and guardian cases added to the disposable-copy SQL artifact (not run against production).
- Playwright at 390px and 1440px, EN and ES: deep links for an event, course, resource, membership and team through login and onboarding; keyboard-only path; focus after errors; invalid code; expired link; recovery; two-account isolation (Scott and Nick).
- Full suite, linter, row counts before and after, no destructive SQL, CHANGELOG v0.x, AGENTS.md rule updates.
- Provider-dependent and reported separately: real email or OTP delivery, Google linking with the same email, and Stripe purchase after verification.

## Files expected to change
src/routes/login.tsx, src/routes/_authenticated/route.tsx, src/routes/_authenticated/_app/route.tsx, src/routes/_authenticated/onboarding.tsx, src/routes/join.$code.tsx, src/routes/e.$id.tsx, src/routes/l.$slug.tsx, src/routes/offer pages, src/routes/_authenticated/_app/me.tsx, GatherwellShell, src/lib/i18n.ts, src/lib/return-to.ts (new), src/lib/claim.ts (new), src/locales/en.json, src/locales/es.json, auth email templates, one new migration, tests/*, tests/database/*, CHANGELOG.md, AGENTS.md, supabase/AGENTS.md.

## Assumptions to confirm
- Attestation (checkbox) is enough for 18+; no birth date.
- Guardian minors are stored as first name and age band only.
- `allows_minors` defaults to off for all existing events.
