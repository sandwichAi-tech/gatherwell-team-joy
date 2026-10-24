import { z } from 'zod';

export const safetyKinds = ['users', 'teams', 'offerings', 'reports', 'audit', 'communities'] as const;
export type SafetyKind = (typeof safetyKinds)[number];
export const safetySearch = z.object({ kind: z.enum(safetyKinds), q: z.string().trim().max(100), state: z.enum(['all', 'active', 'suspended', 'draft', 'published', 'archived', 'open', 'closed', 'mine', 'escalated']), page: z.number().int().min(0).max(10000) });
export const safetyAction = z.object({ kind: z.enum(['report', 'event', 'offer', 'team', 'community', 'community_event', 'community_topic', 'community_team']), id: z.string().uuid(), action: z.enum(['claim', 'escalate', 'resolve', 'dismiss', 'hide', 'unpublish', 'suspend', 'restore']), reason: z.string().trim().min(3).max(500), user: z.string().uuid().optional() });
export type SafetyRow = { id: string; title: string | null; kind: string; state?: string; created_at: string; target_id?: string; reason?: string | null; assignee?: string | null; assigned_to?: string | null; escalated_at?: string | null; actor?: string | null; actor_id?: string | null; members?: number; workspace?: string; user_id?: string; scope_id?: string; team_id?: string };
export function safetyPage(rows: SafetyRow[]) { return { rows: rows.slice(0, 25), hasNext: rows.length > 25 }; }