export type RemovalAction = 'delete' | 'archive';

/** Copy keys per server-decided action; hard delete wording exists only for untouched drafts. */
export function removalCopyKeys(action: RemovalAction) {
  return action === 'delete'
    ? { title: 'resources.removal.deleteTitle', body: 'resources.removal.deleteDraft', confirm: 'resources.removal.delete' }
    : { title: 'resources.removal.archiveTitle', body: 'resources.removal.archiveHistory', confirm: 'resources.removal.archive' };
}

/** Maps the database guard error so hosts see why a removal was refused. */
export function isHistoryGuard(e: unknown): boolean {
  return /resource_has_history/.test(String((e as { message?: string })?.message ?? e ?? ''));
}
