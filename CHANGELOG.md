# ZoheeWell Change Log

## v0.2 — Plans and team licenses can be paid for (2026-10-23)
- Changed: checkout for Pro, Advanced, Team 25 and Team 100 now runs through the built-in payment connection with the provider's own payment form mounted inside the app (no leaving the page). Cancelling keeps paid access until month end; a downgrade is scheduled for month end; a failed payment keeps access while the provider retries. Only plans and team licenses are open for purchase — paid event tickets and paid challenges stay off. A test-mode notice shows on the plan and seats screens.
- Tested: 76 checks pass, including four new ones for the access rules above; the plan and seats screens load with the payment form opening correctly.
- Unverified: an actual test payment. Automated card entry reached "Processing" and stopped with nothing recorded, so a person needs to pay in the preview with 4242 4242 4242 4242 to confirm the whole loop.

## v0.1 — ZoheeWell rules added (2026-10-23)
- Changed: added "ZoheeWell rules (October 2026)" section to the top of PROJECT_RULES.md; created this change log. No app code changed.
- Tested: documentation only; nothing to test.
- Unverified: n/a.
