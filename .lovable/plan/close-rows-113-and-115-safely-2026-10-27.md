# Close rows 113 and 115 safely

## Challenge commerce
- Add a canonical public Challenge page with truthful prices, optional extras, quantities and totals.
- Reuse existing orders, lines, payments and provider events; add only missing reservation/binding fields.
- Make requests retry-safe and finalize enrollment only through verified server payment processing. Reserve capacity and inventory atomically; release failed/cancelled reservations safely.
- Show buyer receipts and owner-only order details. Reconcile confirmed base versus extra-only refunds without exposing participant contacts.
- Keep checkout blocked when provider or host setup is unavailable. Tests use an internal deterministic seam, never a browser-selectable success mode.

## Courses and assessments
- Bind assessments and reused resources to existing lesson slots so all items share one sequence.
- Validate ownership or explicit library eligibility before reuse. Removing course slots preserves standalone resources and learner history.
- Add approved scope document/version references without adding or approving legal text.
- Implement server-calculated immutable assessment receipts, private answers, retry keys, retake history and entitlement checks. Real publication remains blocked without approved scope content.
- Allow recommendations only through validated, accessible authoritative destinations; omit unsupported destinations.

## Verification
- Add focused lifecycle/security tests and run the full existing suite.
- Verify new isolated records across two hosts, two learners and an outsider, with exact cleanup.
- Review changed screens in English/Latin American Spanish at 320, 390 and 1280 pixels, including keyboard focus and overflow.
- Update the change log and report what is implemented, unverified or blocked. Nothing is published or deployed.

## Technical approach
Use existing Cloud RPC authorization, transactional row locks, stable full-ID ordering and shared signed-payment webhook handling. Preserve all existing legal, privacy, team, money and entitlement guards. New database changes are additive and affect the shared backend immediately; no real customer rows are modified.