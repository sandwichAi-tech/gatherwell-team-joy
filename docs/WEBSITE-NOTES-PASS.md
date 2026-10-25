# Website Notes pass — 2026-10-25

This pass is **partial**, not closure of every tracker item. Updated after compile recovery and migrations 0103–0107.

## Available now
- Home copy matches the request, in EN/ES. Names come from the signed-in profile with a first-name fallback.
- Members opens `/team?panel=members`; Upcoming and View all open `/events?tab=upcoming`; Check-ins opens `/attendance?month=YYYY-MM`. Existing event rows and morning brief retain actual IDs. Invitation opens the real team share sheet.
- `/admin` already provides platform-wide inspection and audited management of people/coaches, offerings, teams, moderation, settings and support. Authorized admins see Me → Admin dashboard and an Owner Guide. `/admin-login` signs into existing accounts; it never assigns an admin role.
- Insights filters **scheduled event cohorts** in UTC, not the time each registration was created. Previous period has equal duration. Resource and financial aggregates are explicitly lifetime values. Draft/waitlist rows open actual events. Empty/error states remain honest.
- Communication is top-level for owner/admin/host roles and retains provider readiness. Automation supports selecting one existing workspace event or all events, with registered attendees as its audience.
- Start a challenge launches the independent challenge editor. Event format selects Standard or feature-enabled Retreat, preserving existing persistence. No recurrence relabeling as a multi-event product.

## Remaining work and dependencies
1. **Owner account:** more than one Nick profile was found. Confirm the intended account through authorized identity before changing roles. No email is guessed, no shared password exists, and no role was granted.
2. **Resource communications:** enrollment-specific journeys now use entitlement-bound runs, existing templates, wait/send/enrollment-active steps, pause/resume and capability+participant-scoped activity. Only in-app activation is allowed. Enrollment-to-notification readback remains unverified; email requires a consent-aware sending implementation, not simply adding credentials.
3. **Coach updates:** preference-specific public opt-in, token confirmation/manage/unsubscribe and private aggregate segments are implemented. Requests are blocked until confirmation and marketing senders exist. Full email opt-in readback/delivery is unverified. Segment-targeted campaigns are not connected; this requires further engineering. No SMS promise.
4. **Multi-event experience:** implemented as 2–20 bounded validated sessions on existing events; registration/tickets/check-in cover the whole experience, not individual sessions. Private draft saved and two sessions read back through the event UI. Fixture removed. Signed-out schedule denial/published readback has not been exercised with a new published experience.
5. **Verification:** second-account isolation and live non-admin denial are unverified for this pass; existing server role checks and row policies were inspected, not bypassed. Nonempty attendance, automation save/readback, new retreat save/readback, Saturday Fit Camp published-event link and screen-reader narration are unverified.

## Checks completed
- Full suite: 439 tests / 52 files.
- Typecheck and production build: automatic harness, latest entry clean; no manual duplicate build.
- Browser: signed-out redirects on Home/attendance/admin/challenges; signed-in current requesting account; 32 EN/ES page states at 390/1280px; 640px zoom-reflow proxy on four pages in both languages; keyboard Home card action; View all; invitation sheet; Owner Guide; challenge editor; future/invalid Insights ranges; automation selector.
- No document-wide horizontal overflow in checked states. Six-item mobile navigation intentionally scrolls internally; desktop bottom navigation stays hidden.
- Continuation: EN/ES 390/1280px Discover tabs, Communication resource chooser and experience builder checked; no page errors/overflow. Private experience save/readback verified, temporary event removed. No publishing/providers/credentials; schema migrations were applied to the existing backend.

The last source SHA must be read after platform-managed commit; an earlier SHA is not proof these latest documentation changes are committed.