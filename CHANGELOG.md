# ZoheeWell Change Log

## v0.3 — Walkthrough dead-click audit, report only (2026-10-23)
- Changed: added DEAD_CLICKS.md with 27 actionable findings, seven unfinished/service-dependent groups, current parked-feature behavior, wire/remove recommendations and evidence limits. Updated roadmap. No app code, provider setup or feature flags changed; no explicit save/send/publish/charge/check-in actions submitted.
- Checked: all 59 content-route patterns inventoried/source-reviewed; 120 phone/desktop page inspections, 48 menu/sheet/tab observations and public RSVP navigation to the guest form without submission. All twelve Admin tabs inspected at both sizes. Latest preview status: build OK.
- Unverified: mutation outcomes, complete role matrix, populated lesson/track states, valid private invite/RSVP/preference tokens, external app handoffs and actual payments/delivery. Existing calendar-panel reads can provision missing feed rows; normal app bookkeeping was not disabled.

## v0.2 — Plans and team licenses can be paid for (2026-10-23)
- Changed: checkout for Pro, Advanced, Team 25 and Team 100 now runs through the built-in payment connection with the provider's own payment form mounted inside the app (no leaving the page). Cancelling keeps paid access until month end; a downgrade is scheduled for month end; a failed payment keeps access while the provider retries. Only plans and team licenses are open for purchase — paid event tickets and paid challenges stay off. A test-mode notice shows on the plan and seats screens.
- Tested: 76 checks pass, including four new ones for the access rules above; the plan and seats screens load with the payment form opening correctly.
- Unverified: an actual test payment. Automated card entry reached "Processing" and stopped with nothing recorded, so a person needs to pay in the preview with 4242 4242 4242 4242 to confirm the whole loop.

## v0.1 — ZoheeWell rules added (2026-10-23)
- Changed: added "ZoheeWell rules (October 2026)" section to the top of PROJECT_RULES.md; created this change log. No app code changed.
- Tested: documentation only; nothing to test.
- Unverified: n/a.
