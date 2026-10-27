import { describe, expect, it } from 'vitest';
import { removalCopyKeys, isHistoryGuard } from './resource-removal';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const get = (o: any, k: string) => k.split('.').reduce((a, p) => a?.[p], o);

describe('resource removal policy copy', () => {
  it('archive is the safe action and never says delete', () => {
    expect(removalCopyKeys('archive').confirm).toBe('resources.removal.archive');
    expect(get(en, removalCopyKeys('archive').body)).not.toMatch(/erase|permanent/i);
  });
  it('hard delete copy is only for untouched drafts', () => {
    expect(get(en, removalCopyKeys('delete').body)).toMatch(/draft/i);
  });
  it('every removal key exists in EN and ES', () => {
    for (const a of ['delete', 'archive'] as const) for (const k of Object.values(removalCopyKeys(a))) { expect(get(en, k)).toBeTruthy(); expect(get(es, k)).toBeTruthy(); }
    for (const k of ['deleted', 'archived', 'restored', 'restore', 'archivedBadge', 'historyBlocked']) { expect(get(en, `resources.removal.${k}`)).toBeTruthy(); expect(get(es, `resources.removal.${k}`)).toBeTruthy(); }
  });
  it('recognizes the database history guard', () => {
    expect(isHistoryGuard({ message: 'resource_has_history' })).toBe(true);
    expect(isHistoryGuard({ message: 'other' })).toBe(false);
  });
});
