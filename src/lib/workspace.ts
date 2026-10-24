// Workspace role → capability matrix. Mirrors public.team_capability() in the database;
// used only for interface-level gating (the server re-checks every call).
import { WORKSPACE_ROLES, type WorkspaceRole } from '@/components/workspace-settings';

export type WorkspaceCapability =
  | 'members' | 'settings' | 'content' | 'billing_view' | 'events'
  | 'invites' | 'audit' | 'assign' | 'moderate' | 'analytics' | 'checkin';

const ADMIN_CAPS: WorkspaceCapability[] = ['members', 'settings', 'content', 'billing_view', 'events', 'invites', 'audit', 'assign', 'moderate', 'analytics'];

export const ROLE_CAPABILITIES: Record<WorkspaceRole | 'owner', readonly WorkspaceCapability[]> = {
  owner: ADMIN_CAPS,
  admin: ADMIN_CAPS,
  host: ['events', 'content'],
  content_editor: ['content'],
  checkin: ['checkin'],
  moderator: ['moderate'],
  analyst: ['analytics'],
  member: [],
};

/** True when the workspace role grants the capability. Owner is derived from teams.owner_id, never assigned. */
export function roleAllows(role: WorkspaceRole | 'owner' | null | undefined, cap: WorkspaceCapability): boolean {
  if (!role) return false;
  return (ROLE_CAPABILITIES[role] ?? []).includes(cap);
}

export const ASSIGNMENT_SCOPES = ['event', 'content', 'moderation'] as const;
export type AssignmentScope = (typeof ASSIGNMENT_SCOPES)[number];

/** Which workspace roles may receive which assignment scope (mirrors assign_workspace_scope). */
export const SCOPE_ROLE_MAP: Record<AssignmentScope, readonly WorkspaceRole[]> = {
  event: ['host', 'checkin'],
  content: ['content_editor', 'host'],
  moderation: ['moderator'],
};

export function scopeFitsRole(scope: AssignmentScope, role: WorkspaceRole | 'owner'): boolean {
  if (role === 'owner' || role === 'admin') return false; // full access already; assignments are rejected server-side
  return (SCOPE_ROLE_MAP[scope] as readonly string[]).includes(role);
}

export function isAssignableRole(role: string): role is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(role);
}

/**
 * Builder seats: only people who can build or administer the workspace consume one
 * (owner plus admin/host/content_editor members). Check-in staff, moderators,
 * analysts and plain members never consume a builder seat.
 * Mirrors public.is_builder_workspace_role() in the database.
 */
export const BUILDER_ROLES: readonly WorkspaceRole[] = ['admin', 'host', 'content_editor'];
export function isBuilderRole(role: WorkspaceRole | 'owner' | null | undefined): boolean {
  return role === 'owner' || (!!role && (BUILDER_ROLES as readonly string[]).includes(role));
}
