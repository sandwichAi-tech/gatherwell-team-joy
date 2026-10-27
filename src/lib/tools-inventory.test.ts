import { describe, expect, it } from 'vitest';
import { buildToolSections, hasManagementTools, type ToolsInput } from '@/lib/tools-inventory';

const base: ToolsInput = {
  isLeader: false,
  workspaceRole: null,
  isAdmin: false,
  learnOn: true,
  teamMapOn: true,
  canSellPaid: true,
};

const ids = (input: ToolsInput) => buildToolSections(input).flatMap(s => s.tools.map(t => t.id));
const sectionIds = (input: ToolsInput) => buildToolSections(input).map(s => s.id);

describe('buildToolSections', () => {
  it('plain member sees only support, no management tools', () => {
    const sections = buildToolSections({ ...base, workspaceRole: 'member' });
    expect(sectionIds({ ...base, workspaceRole: 'member' })).toEqual(['help']);
    expect(hasManagementTools(sections)).toBe(false);
  });

  it('signed-in user without a workspace sees only support', () => {
    expect(sectionIds(base)).toEqual(['help']);
  });

  it('host sees events, resources, selling, communication and presence but not team admin or billing', () => {
    const got = ids({ ...base, workspaceRole: 'host' });
    expect(got).toContain('events');
    expect(got).toContain('blueprints');
    expect(got).toContain('waivers');
    expect(got).toContain('learnManage');
    expect(got).toContain('offers');
    expect(got).toContain('communications');
    expect(got).toContain('hostProfile');
    expect(got).not.toContain('teamSettings');
    expect(got).not.toContain('plan');
    expect(got).not.toContain('insights');
    expect(got).not.toContain('admin');
  });

  it('team leader sees every management section including billing and insights', () => {
    const got = ids({ ...base, isLeader: true, workspaceRole: 'member' });
    for (const id of ['events', 'blueprints', 'learnManage', 'offers', 'communications', 'team', 'teamSettings', 'teamInsights', 'teamMap', 'plan', 'planSeats', 'insights', 'hostProfile']) {
      expect(got).toContain(id);
    }
  });

  it('content_editor sees resources and selling but not events or communication', () => {
    const got = ids({ ...base, workspaceRole: 'content_editor' });
    expect(got).toContain('learnManage');
    expect(got).toContain('offers');
    expect(got).not.toContain('events');
    expect(got).not.toContain('communications');
  });

  it('checkin, moderator, analyst and member roles get no management tools', () => {
    for (const role of ['checkin', 'moderator', 'member'] as const) {
      expect(hasManagementTools(buildToolSections({ ...base, workspaceRole: role }))).toBe(false);
    }
    // analyst only gets analytics-capable destinations
    const got = ids({ ...base, workspaceRole: 'analyst' });
    expect(got).toEqual(expect.arrayContaining(['teamInsights', 'insights']));
    expect(got).not.toContain('events');
  });

  it('feature_learn off hides the whole resources section', () => {
    const got = sectionIds({ ...base, isLeader: true, learnOn: false });
    expect(got).not.toContain('resources');
    expect(got).toContain('events');
  });

  it('feature_team_map off hides only the map entry', () => {
    const got = ids({ ...base, isLeader: true, teamMapOn: false });
    expect(got).not.toContain('teamMap');
    expect(got).toContain('teamInsights');
  });

  it('admin section appears only for platform admins', () => {
    expect(ids({ ...base, isAdmin: true })).toEqual(expect.arrayContaining(['admin', 'adminMedia']));
    expect(ids({ ...base, isLeader: true })).not.toContain('admin');
  });

  it('selling tools carry a setup badge until paid selling is fully ready', () => {
    const sections = buildToolSections({ ...base, workspaceRole: 'host', canSellPaid: false });
    const selling = sections.find(s => s.id === 'selling')!;
    expect(selling.tools.every(t => t.badge === 'setup')).toBe(true);
    const ready = buildToolSections({ ...base, workspaceRole: 'host', canSellPaid: true });
    expect(ready.find(s => s.id === 'selling')!.tools.every(t => !t.badge)).toBe(true);
  });

  it('every tool links to a real route path', () => {
    const all = buildToolSections({ ...base, isLeader: true, isAdmin: true }).flatMap(s => s.tools);
    const paths = new Set(all.map(t => t.to));
    expect(paths.size).toBe(all.length); // no duplicate destinations
    for (const p of paths) expect(p).toMatch(/^\/[a-z]/);
  });
});
