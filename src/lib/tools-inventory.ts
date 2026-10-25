// Tools launchpad inventory — pure mapping from the caller's role, plan-independent
// capabilities and feature flags to the sections shown on /tools. Interface-level
// gating only: every destination re-checks authorization server-side.
import { roleAllows, type WorkspaceCapability } from '@/lib/workspace';
import type { WorkspaceRole } from '@/components/workspace-settings';
import type { GwIconName } from '@/components/gw-icon';

export type ToolSectionId =
  | 'events' | 'resources' | 'selling' | 'communication'
  | 'team' | 'insights' | 'presence' | 'admin' | 'help';

export type ToolId =
  | 'events' | 'eventNew' | 'blueprints'
  | 'learn' | 'learnCreate' | 'learnManage' | 'learnTemplates'
  | 'offers' | 'promos' | 'referrals' | 'earnings'
  | 'communications' | 'followups'
  | 'team' | 'teamSettings' | 'teamInsights' | 'teamMap' | 'plan' | 'planSeats'
  | 'insights'
  | 'hostProfile' | 'locations' | 'verify'
  | 'admin' | 'adminMedia'
  | 'support';

export type Tool = { id: ToolId; to: string; icon: GwIconName; badge?: 'setup' | undefined };
export type ToolSection = { id: ToolSectionId; tools: Tool[] };

export type ToolsInput = {
  /** workspace.role === 'leader' — team leadership grants every capability. */
  isLeader: boolean;
  /** Effective workspace role ('owner' is derived from teams.owner_id). */
  workspaceRole: WorkspaceRole | 'owner' | null;
  isAdmin: boolean;
  /** feature_learn flag (admins always pass true). */
  learnOn: boolean;
  /** feature_team_map flag (admins always pass true). */
  teamMapOn: boolean;
  /** From payments readiness: platform connected AND coach payouts active. */
  canSellPaid: boolean;
};

/** Mirrors MANAGER_ROLES in communications.tsx. */
const MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'host'];

export function buildToolSections(input: ToolsInput): ToolSection[] {
  const { isLeader, workspaceRole, isAdmin, learnOn, teamMapOn, canSellPaid } = input;
  const cap = (c: WorkspaceCapability) => isLeader || roleAllows(workspaceRole, c);
  const manager = isLeader || (!!workspaceRole && MANAGER_ROLES.includes(workspaceRole));
  const builder = cap('events') || cap('content');
  const sellBadge: 'setup' | undefined = canSellPaid ? undefined : 'setup';

  const sections: ToolSection[] = [];
  const add = (id: ToolSectionId, tools: Tool[]) => { if (tools.length) sections.push({ id, tools }); };

  add('events', cap('events') ? [
    { id: 'events', to: '/events', icon: 'CalendarDays' },
    { id: 'eventNew', to: '/gathering/new', icon: 'CalendarPlus' },
    { id: 'blueprints', to: '/blueprints', icon: 'Layers' },
  ] : []);

  add('resources', cap('content') && learnOn ? [
    { id: 'learn', to: '/learn', icon: 'BookOpen' },
    { id: 'learnCreate', to: '/learn/create', icon: 'Plus' },
    { id: 'learnManage', to: '/learn/manage', icon: 'Settings2' },
    { id: 'learnTemplates', to: '/learn/templates', icon: 'CopyPlus' },
  ] : []);

  add('selling', cap('content') ? [
    { id: 'offers', to: '/offers', icon: 'Store', badge: sellBadge },
    { id: 'promos', to: '/promos', icon: 'Gift', badge: sellBadge },
    { id: 'referrals', to: '/referrals', icon: 'Share2', badge: sellBadge },
    { id: 'earnings', to: '/earnings', icon: 'CreditCard', badge: sellBadge },
  ] : []);

  add('communication', manager ? [
    { id: 'communications', to: '/communications', icon: 'Megaphone' },
    { id: 'followups', to: '/followups', icon: 'MessageCircle' },
  ] : []);

  add('team', [
    ...(cap('members') ? [{ id: 'team', to: '/team', icon: 'UsersRound' } as Tool] : []),
    ...(cap('settings') ? [{ id: 'teamSettings', to: '/team/settings', icon: 'Settings2' } as Tool] : []),
    ...(cap('analytics') ? [{ id: 'teamInsights', to: '/team/insights', icon: 'BarChart3' } as Tool] : []),
    ...(cap('analytics') && teamMapOn ? [{ id: 'teamMap', to: '/team/map', icon: 'Map' } as Tool] : []),
    ...(cap('billing_view') ? [
      { id: 'plan', to: '/plan', icon: 'CreditCard' } as Tool,
      { id: 'planSeats', to: '/plan/seats', icon: 'UsersRound' } as Tool,
    ] : []),
  ]);

  add('insights', cap('analytics') ? [
    { id: 'insights', to: '/insights', icon: 'BarChart3' },
  ] : []);

  add('presence', builder ? [
    { id: 'hostProfile', to: '/me', icon: 'Globe2' },
    { id: 'locations', to: '/locations', icon: 'MapPin' },
    { id: 'verify', to: '/verify', icon: 'BadgeCheck' },
  ] : []);

  add('admin', isAdmin ? [
    { id: 'admin', to: '/admin', icon: 'ShieldCheck' },
    { id: 'adminMedia', to: '/admin/site-media', icon: 'ImageDown' },
  ] : []);

  add('help', [{ id: 'support', to: '/support', icon: 'LifeBuoy' }]);

  return sections;
}

/** True when the caller has at least one management section (anything beyond help). */
export function hasManagementTools(sections: ToolSection[]): boolean {
  return sections.some(s => s.id !== 'help');
}
