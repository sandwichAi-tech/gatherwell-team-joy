# Roadmap

## Current milestone: In-app communications, discussions, moderation, notification prefs, support routing

- [ ] Audit: announcements, broadcasts/broadcast_reads, comments, discussion_topics, reports, moderation_queue, notification_outbox, existing UI (conversation.tsx, notifications)
- [ ] Migration: host updates (announcements w/ draft/publish/edit/archive + server-derived audience), notification center (in-app, dedupe keys, unread, prefs by category), discussions (toggle per offering, posts/replies/reactions, report, block/mute, scope suspension), moderation actions (hide/lock/remove w/ reason, resolve reports, reporter anonymity, redacted audit), contact-host threads, platform support tickets, rate limits
- [ ] UI: Updates inbox + nav entry, notification center + prefs (email/SMS disabled Setup required), discussion threads, moderation queue UI, contact-host thread, support center
- [ ] Tests: eligibility/audience, read state, dedupe, ownership, reactions, reporting, scoped moderation, reporter anonymity, block/mute, community suspension, contact/support isolation, minors denial, rate limits, audit redaction
- [ ] Live verification with fixtures, cleanup, typecheck/build/tests
- [ ] Docs: CHANGELOG, FEATURE_INVENTORY, SECURITY_NOTES, roadmap; report

## Parked from v0.24
- [ ] Signed-in browser QA for ticket page + check-in (needs injected session)
- [ ] Screen reader + 200% zoom pass on ticket/calendar surfaces
- [ ] Wallet provider certificates (UI gated as Setup required)

## Active: v0.25 QA pass (comms + tickets/check-in)
- [ ] Signed-in browser QA at 390px/1280px: bell, notifications, updates, discussion, moderation, contact host, support, Setup-required gates
- [ ] Ticket QR/print/calendar; check-in manual/invalid/undo/walk-in boundary, totals/export roles
- [ ] A11y: keyboard/focus, 200% zoom, reduced motion, 44px targets, no overflow, EN/ES parity
- [ ] Fix defects + regression tests; clean all ee000010 fixtures; update FEATURE_INVENTORY/CHANGELOG/SECURITY_NOTES
