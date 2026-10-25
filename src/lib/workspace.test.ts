import { describe, expect, it } from 'vitest';
import { WORKSPACE_ROLES } from '@/components/workspace-settings';
import { readFileSync } from 'node:fs';
import { ASSIGNMENT_SCOPES, BUILDER_ROLES, ROLE_CAPABILITIES, SCOPE_ROLE_MAP, isBuilderRole, roleAllows, scopeFitsRole, type WorkspaceCapability } from '@/lib/workspace';
import { BUILDER_SEATS, LICENSES } from '@/lib/billing';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

describe('workspace roles', () => {
  it('offers exactly the seven assignable roles (owner is derived, never assigned)', () => {
    expect(WORKSPACE_ROLES).toEqual(['admin', 'host', 'content_editor', 'checkin', 'moderator', 'analyst', 'member']);
    expect(WORKSPACE_ROLES).not.toContain('owner');
  });
});

describe('role capability matrix (mirrors public.team_capability)', () => {
  it('Communication is available only to owners, admins and hosts', () => {
    for (const role of ['owner', 'admin', 'host'] as const) expect(roleAllows(role, 'messages')).toBe(true);
    for (const role of ['content_editor', 'checkin', 'moderator', 'analyst', 'member'] as const) expect(roleAllows(role, 'messages')).toBe(false);
  });
  const ALL: WorkspaceCapability[] = ['members', 'settings', 'content', 'billing_view', 'events', 'invites', 'audit', 'assign', 'moderate', 'analytics', 'checkin'];

  it('owner and admin hold the full management set, never checkin', () => {
    for (const role of ['owner', 'admin'] as const) {
      for (const cap of ALL) expect(roleAllows(role, cap)).toBe(cap !== 'checkin');
    }
  });

  it('host manages events and content but never billing, members, settings, invites, audit, assign, moderation or analytics', () => {
    expect(roleAllows('host', 'events')).toBe(true);
    expect(roleAllows('host', 'content')).toBe(true);
    for (const cap of ['members', 'settings', 'billing_view', 'invites', 'audit', 'assign', 'moderate', 'analytics', 'checkin'] as const) {
      expect(roleAllows('host', cap)).toBe(false);
    }
  });

  it('content editor reaches content only — no attendee, payment, waiver or team-management surfaces', () => {
    expect(roleAllows('content_editor', 'content')).toBe(true);
    for (const cap of ALL.filter(c => c !== 'content')) expect(roleAllows('content_editor', cap)).toBe(false);
  });

  it('check-in staff hold only the checkin capability', () => {
    for (const cap of ALL) expect(roleAllows('checkin', cap)).toBe(cap === 'checkin');
  });

  it('moderator holds only moderate; analyst holds only analytics; member holds nothing', () => {
    for (const cap of ALL) expect(roleAllows('moderator', cap)).toBe(cap === 'moderate');
    for (const cap of ALL) expect(roleAllows('analyst', cap)).toBe(cap === 'analytics');
    for (const cap of ALL) expect(roleAllows('member', cap)).toBe(false);
  });

  it('null or unknown roles grant nothing', () => {
    expect(roleAllows(null, 'events')).toBe(false);
    expect(roleAllows(undefined, 'content')).toBe(false);
  });

  it('every capability the UI knows is granted to at least one role', () => {
    for (const cap of ALL) {
      expect(Object.values(ROLE_CAPABILITIES).some(caps => caps.includes(cap))).toBe(true);
    }
  });
});

describe('assignment scopes (mirror assign_workspace_scope)', () => {
  it('supports exactly event, content and moderation scopes', () => {
    expect(ASSIGNMENT_SCOPES).toEqual(['event', 'content', 'moderation']);
  });

  it('event scopes go to hosts and check-in staff only', () => {
    expect(SCOPE_ROLE_MAP.event).toEqual(['host', 'checkin']);
    expect(scopeFitsRole('event', 'checkin')).toBe(true);
    expect(scopeFitsRole('event', 'host')).toBe(true);
    expect(scopeFitsRole('event', 'content_editor')).toBe(false);
    expect(scopeFitsRole('event', 'moderator')).toBe(false);
    expect(scopeFitsRole('event', 'member')).toBe(false);
  });

  it('content scopes go to content editors and hosts only', () => {
    expect(scopeFitsRole('content', 'content_editor')).toBe(true);
    expect(scopeFitsRole('content', 'host')).toBe(true);
    expect(scopeFitsRole('content', 'checkin')).toBe(false);
    expect(scopeFitsRole('content', 'analyst')).toBe(false);
  });

  it('moderation scopes go to moderators only', () => {
    expect(scopeFitsRole('moderation', 'moderator')).toBe(true);
    expect(scopeFitsRole('moderation', 'host')).toBe(false);
    expect(scopeFitsRole('moderation', 'member')).toBe(false);
  });

  it('owners and admins never need assignments', () => {
    for (const scope of ASSIGNMENT_SCOPES) {
      expect(scopeFitsRole(scope, 'owner')).toBe(false);
      expect(scopeFitsRole(scope, 'admin')).toBe(false);
    }
  });
});

describe('workspace locale parity', () => {
  const flatten = (o: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
  it('EN and ES workspace keys match', () => {
    expect(flatten(es.workspace as Record<string, unknown>).sort()).toEqual(flatten(en.workspace as Record<string, unknown>).sort());
  });
  it('every assignable role and invite state has a label', () => {
    for (const r of WORKSPACE_ROLES) {
      expect(en.workspace.role[r]).toBeTruthy();
      expect(es.workspace.role[r]).toBeTruthy();
    }
    for (const s of ['pending', 'accepted', 'expired', 'revoked']) {
      expect(en.workspace.state[s as keyof typeof en.workspace.state]).toBeTruthy();
    }
  });
  it('every assignment scope and server error code has a bilingual label', () => {
    for (const s of ASSIGNMENT_SCOPES) {
      expect(en.workspace.scope[s]).toBeTruthy();
      expect(es.workspace.scope[s]).toBeTruthy();
    }
    for (const code of ['invalid_scope_type', 'role_needs_no_assignment', 'invalid_scope_for_role', 'scope_not_found', 'already_assigned', 'not_found', 'not_allowed', 'forbidden']) {
      expect(en.workspace.err[code as keyof typeof en.workspace.err]).toBeTruthy();
      expect(es.workspace.err[code as keyof typeof es.workspace.err]).toBeTruthy();
    }
    for (const action of ['assignment_created', 'assignment_revoked', 'assignment_reactivated']) {
      expect(en.workspace.action[action as keyof typeof en.workspace.action]).toBeTruthy();
      expect(es.workspace.action[action as keyof typeof es.workspace.action]).toBeTruthy();
    }
  });
});

describe('builder seats (approved 2026-10-24 model)', () => {
  it('owner, admin, host and content_editor consume a builder seat', () => {
    for (const r of ['owner', 'admin', 'host', 'content_editor'] as const) expect(isBuilderRole(r)).toBe(true);
  });
  it('check-in, moderator, analyst and member never consume a builder seat', () => {
    for (const r of ['checkin', 'moderator', 'analyst', 'member'] as const) expect(isBuilderRole(r)).toBe(false);
    expect(isBuilderRole(null)).toBe(false);
    expect(isBuilderRole(undefined)).toBe(false);
  });
  it('builder roles are a subset of the workspace roles', () => {
    for (const r of BUILDER_ROLES) expect(WORKSPACE_ROLES).toContain(r);
  });
  it('plan builder-seat limits are 3/3/5 and licenses 25/100', () => {
    expect(BUILDER_SEATS).toEqual({ free: 3, growth: 3, pro: 5 });
    expect(LICENSES.map(l => [l.id, l.seats])).toEqual([['team25', 25], ['team100', 100]]);
  });
  it('the database mirror classifies the same roles', () => {
    const sql = readFileSync('drizzle/migrations/0088_v5_plan_fee_ladder_builder_seats.sql', 'utf8');
    expect(sql).toContain(`SELECT _role IN ('admin','host','content_editor')`);
    expect(sql).toContain('team_builder_seat_limit');
    expect(sql).toContain("WHEN _plan = 'pro' THEN 5 ELSE 3 END");
  });
});
