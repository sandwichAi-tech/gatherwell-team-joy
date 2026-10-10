import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { ListSkeleton } from '@/components/launch-states';
import { Button } from '@/components/ui/button';
import { getDay60, setFoundingStay } from '@/lib/admin.functions';
import { DAY60_SAMPLE, dayCount, evaluateDay60, verdict } from '@/lib/day60';

export function Day60Admin() {
  const { t } = useTranslation(); const qc = useQueryClient();
  const load = useServerFn(getDay60); const stay = useServerFn(setFoundingStay);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'day60'], queryFn: () => load() });
  if (isLoading) return <ListSkeleton />;
  if (isError || !data) return <section className="panel empty-panel"><p className="muted-copy">{t('day60.error')}</p><Button variant="secondary" onClick={() => void refetch()}>{t('error.retry')}</Button></section>;
  const sample = !data.start_date; const raw = sample ? DAY60_SAMPLE : data;
  const targets = evaluateDay60(raw); const met = targets.filter(x => x.met).length; const v = verdict(met);
  const day = sample ? 23 : dayCount(data.start_date!);
  return <div className="day60">
    <section className="panel day60-summary" aria-labelledby="d60-title">
      <div className="section-heading"><div><p className="eyebrow">{t('day60.day', { n: day })}{sample && <span className="chip day60-sample">{t('day60.sample')}</span>}</p>
        <h2 id="d60-title">{t('day60.met', { n: met })}</h2></div>
        <span className={`chip day60-verdict is-${v}`}>{t(`day60.verdict.${v}`)}</span></div>
      <div className="day60-bar" role="progressbar" aria-valuemin={0} aria-valuemax={60} aria-valuenow={day} aria-label={t('day60.day', { n: day })}><span style={{ width: `${(day / 60) * 100}%` }} /></div>
      <p className="field-hint">{t('day60.rule')}</p>
      {sample && <p className="field-hint">{t('day60.sampleHint')}</p>}
    </section>
    <ol className="panel day60-list">{targets.map((x, i) => <li key={x.key} className={x.met ? 'is-met' : ''}>
      <span className="day60-icon" aria-hidden="true"><GwIcon name={x.met ? 'CheckCircle2' : 'Circle'} size={22} /></span>
      <span className="day60-text"><strong>{i + 1}. {t(`day60.t.${x.key}`)}</strong><small>{t(`day60.p.${x.key}`, x.params)}</small></span>
      <span className="day60-value">{x.value}<span className="sr-only"> · {x.met ? t('day60.metLabel') : t('day60.notMet')}</span></span>
    </li>)}</ol>
    <section className="panel"><h2 className="section-title">{t('day60.stayTitle')}</h2><p className="field-hint">{t('day60.stayHint')}</p>
      {sample ? <p className="auth-subtitle">{t('day60.stayNeedsStart')}</p> : !raw.coaches?.length ? <p className="auth-subtitle">{t('founding.admin.empty')}</p> :
        <ul className="admin-list">{raw.coaches.map(c => <li key={c.id} className="day60-stay"><span>{c.name || '—'}</span>
          <span className="day60-stay-btns" role="group" aria-label={c.name}>{([true, false, null] as const).map(val => <Button key={String(val)} size="sm" variant={c.stay === val ? 'default' : 'secondary'} aria-pressed={c.stay === val}
            onClick={async () => { await stay({ data: { id: c.id, stay: val } }); void qc.invalidateQueries({ queryKey: ['admin', 'day60'] }); }}>{t(`day60.stay.${String(val)}`)}</Button>)}</span></li>)}</ul>}
    </section>
  </div>;
}
