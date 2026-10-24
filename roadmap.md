# Roadmap

## Completed: v0.26 QA pass (communications + tickets/check-in)

- [x] Signed-in browser QA at 390px and 1280px: bell, notifications, updates, discussion, contact host, support, Setup-required gates.
- [x] Ticket QR/fallback/calendar and check-in manual/invalid/repeat/undo flows.
- [x] Accessibility: keyboard focus and restoration, 200% zoom, reduced motion, 44px targets, no overflow, EN/ES parity.
- [x] Defects fixed with regression tests; full suite, typecheck and production build pass.
- [x] Temporary ee000010/Fx10 fixtures fully removed (public rows and the fixture auth account), verified at zero; real owner adult confirmation preserved.

## Remaining manual/device checks

- [ ] Screen-reader narration pass on ticket/calendar, communications and check-in surfaces.
- [ ] Real-device camera permission and live QR scan pass.
- [ ] Wallet provider certificates (UI remains gated as Setup required).

## Completed: v0.27 insights, admin support, privacy & data

- [x] Host /insights dashboard with real event/offering/sales aggregates and aggregate-only CSV exports.
- [x] Team analytics gated to owner/admin/analyst via team_capability.
- [x] Admin support-ticket triage tab with audited staff replies and close.
- [x] Me > Privacy & data: Download my data (JSON, own rows only) and consent history.
- [x] 287 tests, typecheck, build; browser QA 17/17 (phone/desktop, EN/ES); no fixtures created.

## Remaining

- [ ] v0.28: platform safety queues, private lookup, reversible interventions, scoped suspensions and audit.
- [ ] v0.28: authorization tests, bilingual phone/desktop QA, fixture cleanup and release documentation.

- [ ] Browser pass of the admin support tab as an admin account (RPC denial verified; no admin account in this environment).
- [ ] Screen-reader pass on the new insights/privacy panels.
