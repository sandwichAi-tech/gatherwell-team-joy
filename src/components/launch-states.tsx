import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function ListSkeleton() {
  const { t } = useTranslation();
  return <div className="list-skeleton" role="status" aria-label={t('publicEvent.loading')} aria-busy="true">{[0, 1, 2].map(n => <div key={n} className="skeleton-row"><span className="skeleton skeleton-avatar" /><div><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line is-short" /></div></div>)}</div>;
}

export function RetryState({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return <div className="retry-state" role="alert"><p>{t('error.message')}</p><Button variant="secondary" onClick={retry}>{t('error.retry')}</Button></div>;
}

/** Covers initial list fetches and failed queries, without blocking cached content. */
export function QueryFeedback() {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const failed = qc.getQueryCache().getAll().filter(q => q.getObserversCount() > 0 && q.state.status === 'error');
  const initial = qc.getQueryCache().getAll().some(q => q.getObserversCount() > 0 && q.state.fetchStatus === 'fetching' && q.state.data === undefined);
  return <>{fetching > 0 && initial && <ListSkeleton />}{failed.length > 0 && <RetryState retry={() => { for (const q of failed) void qc.resetQueries({ queryKey: q.queryKey, exact: true }); }} />}</>;
}