# Attendance launch pass — 2026-10-26

No publication, deployment, external sending, real payment, or physical-device testing occurred.

## Row results

| Row | Implemented and evidence | Status / remaining gap |
|---|---|---|
| 93 | Own Home QR decoded in memory with jsQR; decoded code admitted the correct attendee via host scanner manual fallback. Wrong-event rejected; duplicate returned already. Home EN/ES 320/390/1280 had no overflow. | In Progress: physical phone/camera loop unavailable. |
| 98 | Host Home and management direct event-bound action; owner and assigned check-in staff authorized, outsider roster/scan rejected. Two attendees checked in. Required unaccepted waiver, cancelled registration, invalid and wrong-event codes rejected; duplicate idempotent. Camera unavailable manual fallback exercised. | In Progress: physical camera plus full offline/network/retry and waiver-resolution browser matrix unverified. |
| 99 | Attendance-only or separately selected absent journey; editable subject/body/channel and event-local date; next-day 09:00 default saved through UI. In-app isolated capture: one attended message, zero on rerun. Absent, cancelled, email opt-out and attendance correction eligibility checked. Host legacy-owner capability and mobile focus defects fixed. | In Progress: full schedule-edit, pending-dispatch preference and concurrent correction matrix not exercised end-to-end. |
| 100 | Fresh coach onboarding, free publication, signed-out event page, public registration/confirmation, account-owned QR, host admission and follow-up capture. Sending surfaces truthfully show email/SMS setup required; address directions do not depend on map search. | In Progress: complete fresh attendee onboarding/role-switch, team invite approval, free-resource browser flow; configured paid checkout/refund, real delivery and physical phones unavailable/unverified. |

## Changed files

- `drizzle/migrations/0137`–`0142` attendance guards, journey schedule/deduplication, worker eligibility/scoped processing, notification category and waiver-history binding; generated database types.
- `src/components/host-checkin-actions.tsx`, `gatherwell-pages.tsx`, `customer-home.tsx` and event/check-in routes: quick actions, own QR/directions and scanner feedback.
- `src/components/attendance-journey.tsx`, `communications.tsx`, `src/lib/messaging.functions.ts`, `src/lib/notify/process.server.ts`: editor, capability fix, provider gates and processing.
- `src/lib/checkin-result.ts`, `attendance-schedule.ts` and their tests; outbox worker tests; EN/ES resources; architecture, roadmap and change log.

## Test/compile evidence

- Focused: 6 files / 20 tests passed; final subset 3 files / 14 tests passed.
- Final full suite: 83 files / 718 tests passed, 54.98 seconds.
- Supported automatic typecheck/compile: build OK, 22:51:14 UTC; no manual production build or typecheck permitted by environment instructions.
- Editor EN/ES at 320/390/1280: no horizontal overflow, keyboard focus inside sheet, zero observed runtime errors. Home reviewed at the same sizes/languages. No token-bearing screenshot saved.

## Readiness and cleanup

Payment runtime secret absent; a sandbox-key variable exists but does not establish configured provider test checkout. Transactional email and SMS sender credentials absent. Maps search unavailable, saved-address directions supported. Free flow is not payment or delivery evidence. In-app capture used the scoped fixture journey only; no global sending worker invoked.

Four exact new accounts, one team, two events, three registrations and all created journey/waiver/assignment/outbox/notification/run dependencies removed. Exact-ID empty reads verified. Scan rate-limit attempts and temporary browser sessions/scripts/screenshots removed. No older fixtures touched.