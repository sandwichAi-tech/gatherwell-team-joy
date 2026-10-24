# Roadmap

## Current milestone: Workspace role enforcement and scoped assignments

- [ ] Migration 0075: workspace_assignments table + RLS + RPCs; fix set_member_suspension bug (writes now() into workspace_role); is_team_member excludes suspended; can_checkin_event + checkin_guest_list (minimal fields); extend can_manage_event / can_access_event_participants / can_edit_track / can_moderate_comment to workspace roles; moderation_queue + team_analytics_summary (aggregate-only)
- [ ] src/lib/workspace.ts: role→capability matrix + scope types (pure, tested)
- [ ] account.ts / team-switcher: suspended memberships excluded from active workspace, safe fallback
- [ ] WorkspaceSettings: Assignments tab (list/create/revoke/reactivate, empty/loading/error, audit)
- [ ] team settings route gated to owner/admin; check-in page uses minimal guest-list RPC; shell creation options gated by capability
- [ ] Tests: role matrix, scope validation, locale parity; disposable SQL fixture file
- [ ] Live verification with fixtures (role boundaries, cross-team isolation, revoked assignments, suspended users), then clean all fixtures
- [ ] Typecheck/build/tests; browser QA 390px + desktop (switching, assignments, keyboard, overflow)
- [ ] Docs: CHANGELOG, PROJECT_RULES/SECURITY_NOTES update, memory; completion report
