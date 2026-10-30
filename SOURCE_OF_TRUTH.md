# ZoheeWell source of truth

- **Authority:** ZoheeWell Beta Product Blueprint and Lovable Build Plan, Version 4

## Launch mode decision (2026-10-29)
Owner-approved by Scott Messier on 2026-10-29, agreed with Nick and Michael.

For the beta launch, the visible product is limited to the launch menu below. Every other built feature stays in the code and data behind a feature switch, off for regular users, until the owners turn it on. This does not delete or change any feature; it decides what people see first.

Launch menu:
- **Hosts:** events (one-time and weekly), event templates, guest list, check-in, waivers, follow-ups, simple resources (video, audio, guide, file, link, recipe), free challenges, public host page, team, insights.
- **Guests:** discover, event pages, RSVP and tickets, their events, hosts they follow, resources shared with them.
- **Switched off for launch:** courses, bundles, wellness assessment, live sessions as a resource type, retreats and multi-event formats, paid selling of any kind (offers, Circles, promos, earnings, seats, paid challenges, paid resources) until payments are live, referral rewards, communications automations and journeys, alerts, locations, network, team map, playbook, limited badges, careers and studios pages.

- **Decision date:** 2026-10-23
- **Order of authority:** Blueprint v4 → Lovable Project Knowledge → PROJECT_RULES.md → DESIGN_RULES.md → AGENTS.md (and nested AGENTS.md files). A lower source never overrides a higher one.
- **Historical records are not active instructions.** Any file or section marked "Historical record" (audits, reviews, archived plans, old rule sections, CHANGELOG history) documents the past only. Migrations are an audit trail of schema history, not current product rules.
- **Change control:** changes to approved scope, price, fee, brand, privacy, trust, or policy require explicit written approval from the owner and a CHANGELOG.md entry before they take effect.

## Implementation status note
Code and data may still reflect pre-v4 values (for example the old fee ladder in plan_settings, the old palette tokens, and Spanish switched off in src/lib/i18n.ts) until the approved Prompt 1–17 sequence changes them. That status is not a rule; v4 is the target.
