import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useGatherwell } from './gatherwell-shell';
import { getAttendanceHistory } from '@/lib/insights.functions';
import { useServerFn } from '@tanstack/react-start';
import { ListSkeleton, RetryState, EmptyState } from './launch-states';
import { Input } from './ui/input';

export function AttendancePage({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const { t, i18n } = useTranslation();
  const { userId } = useGatherwell();
  const read = useServerFn(getAttendanceHistory);
  const q = useQuery({ queryKey: ['attendance-history', userId, month], queryFn: () => read({ data: { month } }) });
  return <div className="page-stack"><header className="page-heading"><div><h1>{t('attendanceHistory.title')}</h1><p>{t('attendanceHistory.definition')}</p></div></header>
    <label className="field-label">{t('attendanceHistory.month')}<Input type="month" value={month} onChange={e => { if (e.target.value) onMonth(e.target.value); }} /></label>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data.length ? <EmptyState icon="CircleCheck" text={t('attendanceHistory.empty')} /> : <div className="event-list">{q.data.map(e => <Link className="event-row" key={e.id} to="/event/$id" params={{ id: e.id }}><div className="event-info"><h2>{e.title}</h2><p>{new Date(e.starts_at).toLocaleDateString(i18n.resolvedLanguage)} · {t('attendanceHistory.count', { count: e.count })}</p></div></Link>)}</div>}
  </div>;
}