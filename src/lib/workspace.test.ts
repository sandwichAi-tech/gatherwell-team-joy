import { describe, expect, it } from 'vitest';
import { WORKSPACE_ROLES } from '@/components/workspace-settings';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

describe('workspace roles', () => {
  it('offers exactly the seven assignable roles (owner is derived, never assigned)', () => {
    expect(WORKSPACE_ROLES).toEqual(['admin', 'host', 'content_editor', 'checkin', 'moderator', 'analyst', 'member']);
    expect(WORKSPACE_ROLES).not.toContain('owner');
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
});
