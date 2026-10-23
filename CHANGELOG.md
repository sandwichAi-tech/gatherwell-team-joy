# ZoheeWell Change Log

## v0.5 — Resources restored to main navigation (2026-10-23)
- Changed: turned on the existing feature_learn setting for everyone; renamed Learn to Resources in navigation, page headings, back links, management labels and page metadata. Kept /learn and all existing content routes. Host navigation retains five tabs; attendee navigation adds Resources without removing Circles or Progress. Existing tracks, lessons, recipes and leader management are reused; the Section 7 reorganization is deferred.
- Hidden: zero-lesson tracks from the reader library (still editable in management); empty Your tracks section, empty Live sessions/replays section, and empty or failed Recipes preview/View all link. The current database has no tracks or lessons and six published recipes, so track/live blocks are hidden now. A fully empty library shows one honest empty state. No functioning content or management controls were removed; no placeholder create option is exposed by this change.
- Tested: 21 targeted checks passed for enabled Resources access without admin status, parked-feature isolation, zero-lesson filtering, existing protected /learn routing and English/Spanish key parity. Confirmed feature_learn is enabled in Lovable Cloud. Preview build status checked.
- Unverified: signed-in phone/desktop navigation and recipe interactions using a real non-admin account. The requesting user has no matching app account; permission to sign in as an existing non-admin was declined. No role checks were bypassed or mock session substituted. Populated track/lesson playback remains unverified because no tracks/lessons exist yet.

## v0.4 — Event Blueprints work across Team and Events (2026-10-23)
- Changed: reused the existing template library and editor for a dedicated Event Blueprints screen linked from Team and Events. Cards show cover, title, type and usage. New/Edit opens the blueprint editor; deletion is confirmed. Type, description, length, capacity, in-person/online mode, price and cover carry into event creation, leaving date/time/place to the host. Save as blueprint is available to the event creator, not only team leaders; host-owned edits/deletes are protected. The Start from a blueprint row remains. Team-only defaults stay free; storing a price does not enable paid ticket checkout.
- Tested: 10 targeted checks passed; real create → prefilled draft event → Save as blueprint, edit, usage count and delete passed at 375px phone and 1440px desktop. Team/Events links passed; latest preview build OK. All test-only blueprints and draft events were removed through the UI, with zero remaining confirmed by read-back.
- Unverified: real-device camera/photo cropping in this pass, paid event publication/checkout, and a separate non-leader host account. Ownership/default rules have automated coverage; browser checks used the existing administrator/leader account.

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
