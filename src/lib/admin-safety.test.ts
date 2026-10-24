import { describe, expect, it } from 'vitest';
import { safetySearch, safetyAction, safetyPage, safetyRestrictionIsSelf, type SafetyRow } from './admin-safety';

const id = 'ee000028-0000-4000-8000-000000000001';
describe('Platform safety input boundaries', () => {
  it('rejects negative pagination', () => expect(safetySearch.safeParse({ kind: 'users', q: '', state: 'all', page: -1 }).success).toBe(false));
  it('rejects unbounded search', () => expect(safetySearch.safeParse({ kind: 'teams', q: 'x'.repeat(101), state: 'all', page: 0 }).success).toBe(false));
  it('requires a meaningful reason', () => expect(safetyAction.safeParse({ kind: 'event', id, action: 'unpublish', reason: '  ' }).success).toBe(false));
  it('rejects account deletion in the safety workflow', () => expect(safetyAction.safeParse({ kind: 'user', id, action: 'delete', reason: 'Safety review' }).success).toBe(false));
  it('requires a valid community user identity', () => expect(safetyAction.safeParse({ kind: 'community_event', id, action: 'suspend', reason: 'Safety review', user: 'someone' }).success).toBe(false));
  it('caps each page at 25 and keeps the next-page signal', () => { const rows = Array.from({ length: 26 }, (_, n): SafetyRow => ({ id: String(n), title: 'item', kind: 'event', created_at: '2026-10-24' })); expect(safetyPage(rows).rows.length).toBe(25); expect(safetyPage(rows).hasNext).toBe(true); });
  it('does not invent another page for 25 results', () => { const rows = Array.from({ length: 25 }, (_, n): SafetyRow => ({ id: String(n), title: null, kind: 'user', created_at: '2026-10-24' })); expect(safetyPage(rows).hasNext).toBe(false); });
});
describe('Safety self-target rule', () => { it('blocks the acting account', () => expect(safetyRestrictionIsSelf(id,id)).toBe(true)); it('permits another account', () => expect(safetyRestrictionIsSelf(id,'ee000029-0000-4000-8000-000000000002')).toBe(false)); });
