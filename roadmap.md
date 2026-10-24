# Roadmap

## Current milestone: Tickets, check-in operations, attendance exports, calendar

- [ ] Audit: My tickets, event-day functions, check-in page, calendar route, rsvps schema
- [ ] Migration 0078: admission tokens (opaque high-entropy, server-validated), ticket payload RPC, attendance totals RPC, CSV export RPC (manager-only, minimal fields), audit event-day mutations, rate-limit token validation
- [ ] Ticket detail page: QR + alphanumeric fallback, print view, cancelled/refunded/waitlisted/expired states
- [ ] Check-in route: camera scan w/ manual fallback, attendee search, idempotent check-in, undo w/ confirm+audit, party size, walk-in (managers only), re-entry history
- [ ] Attendance totals (registered/checked-in/waitlisted/cancelled/remaining) + CSV export (formula-injection safe, UTF-8, manager-only)
- [ ] Calendar: .ics generation (single/recurring/multi-day, stable UID, timezone, cancel), Apple/Google/Outlook links, public vs private-ticket payloads
- [ ] Wallet: Apple/Google "Setup required" disabled states
- [ ] In-app status notifications via existing infra; email/SMS stay Setup required
- [ ] Tests: token privacy/entropy, wrong-event, idempotency, undo/re-entry, party sizes, role boundaries, CSV injection, ICS recurrence/timezones/cancel, private auth, cancelled tickets, guest claim
- [ ] Typecheck/build/tests; browser QA 390px + desktop; clean fixtures; docs (CHANGELOG, FEATURE_INVENTORY, SECURITY_NOTES); report
