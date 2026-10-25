# Website Notes pass — 2026-10-25

This pass is **partial**, not closure of every tracker item.

## Available now
- Home copy matches the request, in EN/ES. Names come from the signed-in profile with a first-name fallback.
- Members opens `/team?panel=members`; Upcoming and View all open `/events?tab=upcoming`; Check-ins opens `/attendance?month=YYYY-MM`. Existing event rows and morning brief retain actual IDs. Invitation opens the real team share sheet.
- `/admin` already provides platform-wide inspection and audited management of people/coaches, offerings, teams, moderation, settings and support. Authorized admins see Me → Admin dashboard and an Owner Guide. `/admin-login` signs into existing accounts; it never assigns an admin role.
- Insights filters **scheduled event cohorts** in UTC, not the time each registration was created. Previous period has equal duration. Resource and financial aggregates are explicitly lifetime values. Draft/waitlist rows open actual events. Empty/error states remain honest.
- Communication is top-level for owner/admin/host roles and retains provider readiness. Automation supports selecting one existing workspace event or all events, with registered attendees as its audience.
- Start a challenge launches the independent challenge editor. Event format selects Standard or feature-enabled Retreat, preserving existing persistence. No recurrence relabeling as a multi-event product.

## Remaining work and dependencies
1. **Owner account:** more than one Nick profile was found. Confirm the intended account through authorized identity before changing roles. No email is guessed, no shared password exists, and no role was granted.
2. **Resource communications:** enrollment-specific triggers, offerings attribution, audience authorization and journey execution remain engineering work. The current interface explicitly says they are not connected.
3. **Coach updates:** preference-specific public opt-in, verification, secure manage/unsubscribe links and private segments are not implemented. These are announcements, not fulfillment emails; they must not use the managed app-email service as marketing. Delivery needs an appropriate marketing-email service; configuring one alone will not finish the missing subscription work. No SMS promise.
4. **Multi-event experience:** distinct bounded session storage and public display, registration/attendance semantics, server validation, access policies and tests remain engineering work. Existing recurring events and retreat itineraries are not substitutes.
5. **Verification:** second-account isolation and live non-admin denial are unverified for this pass; existing server role checks and row policies were inspected, not bypassed. Nonempty attendance, automation save/readback, new retreat save/readback, Saturday Fit Camp published-event link and screen-reader narration are unverified.

## Checks completed
- Full suite: 437 tests / 51 files.
- Typecheck and production build: automatic harness, latest entry clean; no manual duplicate build.
- Browser: signed-out redirects on Home/attendance/admin/challenges; signed-in current requesting account; 32 EN/ES page states at 390/1280px; 640px zoom-reflow proxy on four pages in both languages; keyboard Home card action; View all; invitation sheet; Owner Guide; challenge editor; future/invalid Insights ranges; automation selector.
- No document-wide horizontal overflow in checked states. Six-item mobile navigation intentionally scrolls internally; desktop bottom navigation stays hidden.
- No fixtures created, existing rows untouched, no publishing/providers/credentials.

The last source SHA must be read after platform-managed commit; an earlier SHA is not proof these latest documentation changes are committed.