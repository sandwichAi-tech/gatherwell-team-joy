# ZoheeWell source of truth

- **Authority:** ZoheeWell Beta Product Blueprint and Lovable Build Plan, Version 4
- **Decision date:** 2026-10-23
- **Order of authority:** Blueprint v4 → Lovable Project Knowledge → PROJECT_RULES.md → DESIGN_RULES.md → AGENTS.md (and nested AGENTS.md files). A lower source never overrides a higher one.
- **Historical records are not active instructions.** Any file or section marked "Historical record" (audits, reviews, archived plans, old rule sections, CHANGELOG history) documents the past only. Migrations are an audit trail of schema history, not current product rules.
- **Change control:** changes to approved scope, price, fee, brand, privacy, trust, or policy require explicit written approval from the owner and a CHANGELOG.md entry before they take effect.

## Implementation status note
Code and data may still reflect pre-v4 values (for example the old fee ladder in plan_settings, the old palette tokens, and Spanish switched off in src/lib/i18n.ts) until the approved Prompt 1–17 sequence changes them. That status is not a rule; v4 is the target.
