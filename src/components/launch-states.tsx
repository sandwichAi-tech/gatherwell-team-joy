import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GwFeatureTile, type GwIconName } from '@/components/gw-icon';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createQueryCacheRevisionStore } from '@/lib/query-cache-store';

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(timer); }, []);
  return <div className="list-skeleton" role="status" aria-label={t('publicEvent.loading')} aria-busy="true">{Array.from({ length: rows }, (_, n) => <div key={n} className="skeleton-row"><span className="skeleton skeleton-avatar" /><div><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line is-short" /></div></div>)}{slow && <RetryState retry={() => window.location.reload()} />}</div>;
}

export function RetryState({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return <div className="retry-state" role="alert"><GwFeatureTile name="AlertCircle" size={24} /><div className="retry-copy"><strong>{t('error.title')}</strong><p>{t('error.message')}</p></div><Button variant="secondary" onClick={retry}>{t('error.retry')}</Button></div>;
}

/** Shared empty state: tinted icon tile, optional title, muted text, optional action. */
export function EmptyState({ icon, title, text, action, compact }: { icon: GwIconName; title?: string; text: string; action?: ReactNode; compact?: boolean }) {
  return <div className={`gw-empty-state ${compact ? 'is-compact' : ''}`}><GwFeatureTile name={icon} size={compact ? 24 : 28} /><div>{title && <h3>{title}</h3>}<p>{text}</p></div>{action}</div>;
}

/** Covers initial list fetches and failed queries, without blocking cached content. */
export function QueryFeedback() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const cacheStore = useMemo(() => createQueryCacheRevisionStore(qc), [qc]);
  useSyncExternalStore(cacheStore.subscribe, cacheStore.getSnapshot, cacheStore.getSnapshot);
  const fetching = useIsFetching();
  const failed = qc.getQueryCache().getAll().filter(q => q.getObserversCount() > 0 && q.state.status === 'error');
  const initial = qc.getQueryCache().getAll().some(q => q.getObserversCount() > 0 && q.state.fetchStatus === 'fetching' && q.state.data === undefined);
  return <>{fetching > 0 && initial && <div className="gw-progress" role="progressbar" aria-busy="true" aria-label={t('publicEvent.loading')} />}{failed.length > 0 && <RetryState retry={() => { for (const q of failed) void qc.resetQueries({ queryKey: q.queryKey, exact: true }); }} />}</>;
}
