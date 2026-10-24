# Platform safety completion

- Preserve completed Support, Insights, workspace moderation and existing admin navigation.
- Replace legacy safety lists with paginated, rate-limited, privacy-minimized user/workspace/offering lookup and report queues.
- Add report claim/escalate/resolve/dismiss lifecycle, reason history and reversible hiding/unpublishing with transactional audit records.
- Reuse separate account, workspace and community suspension scopes; require reasons and confirmation and never delete accounts in this safety workflow.
- Protect the admin route and every safety RPC using the existing server-derived platform role; no real-user promotion.
- Deliver matching English/Spanish controls, safe audit history, focused authorization tests and phone/desktop browser checks.
- Update release/security/inventory/roadmap facts, verify temporary-fixture cleanup and run the full tests. The harness supplies typecheck/build verification.

## Technical details
Use existing reports, admin_audit, suspension and offering tables with additive migrations. New safety RPCs centralize caller validation, bounded pagination, throttling, safe projections and atomic actions. Preserve legacy endpoints but remove sensitive fields from lookup/report/audit read paths. A temporary admin identity is used only if safely provisionable and fully removable; otherwise record the exact browser limitation.