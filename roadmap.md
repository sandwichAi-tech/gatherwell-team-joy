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

- [x] v0.28 focused closure: 303 tests/41 files, final-source harness build OK; 37 admin/anon + 60 other-role live assertions, grant checks, rollback SQL checks, saturation 66 requests/12 safe rejections, Support 20/20, account lifecycle 22/22; six auth users removed, 140-table scan zero.

- [x] Clarified parallel-site workflow: remix latest, revert original; pre-remix Cloud versions cannot be restored in the remix; code revert does not roll back data.
- [x] v0.28: platform safety queues, private lookup, reversible interventions, scoped suspensions and audit.
- [x] v0.28: 294 tests; 28 admin page checks, 8 keyboard checks, 17 denial/UI checks, 15 live action checks; all temporary fixtures removed, 140-table scan zero, release documentation updated.

- [x] Admin support tab empty/list layout verified using isolated removable QA admin, EN/ES, phone/desktop.
- [x] Nonempty admin Support staff-reply/close browser check, four tickets, audit counts verified.
- [x] Fixture account managed-auth ban/reactivation lifecycle; failure compensation unit tests; throttle saturation checked. Cross-service atomicity is explicitly not claimed.
- [x] Equivalent live role/RLS/grant and transaction rollback verification substituted for unavailable disposable database; original disposable script not claimed executed.
- [ ] Screen-reader pass on the new insights/privacy panels.
