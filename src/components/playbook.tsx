import { useFeature } from '@/lib/feature-flags';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sparkles } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';

type Card = { kind: 'slot' | 'length' | 'followup'; category: string | null; params: { dow: number; hour: number; ratio: number; min: number; max: number; fast: number; slow: number }; sample: boolean };
type Side = { gatherings: number; avg_checkins: number; showup: number };
type Bench = { team: Side; network: Side; sample: boolean };

function usePlaybookText() {
  const { t, i18n } = useTranslation(); const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const cat = (c: string | null) => t(`landing.catOne.${c ?? 'more'}`);
  const day = (d: number) => new Date(Date.UTC(2024, 0, 7 + d, 12)).toLocaleDateString(lang, { weekday: 'long', timeZone: 'UTC' });
  const time = (h: number) => new Date(Date.UTC(2024, 0, 7, h)).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  const num = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 });
  const any = (c: Card) => !c.category || c.category === 'more';
  return (c: Card) => c.kind === 'slot' ? t(any(c) ? 'playbook.slotAny' : 'playbook.slot', { cat: cat(c.category), day: day(c.params.dow), time: time(c.params.hour), ratio: num(c.params.ratio) })
    : c.kind === 'length' ? t(any(c) ? 'playbook.lengthAny' : 'playbook.length', { cat: cat(c.category), min: c.params.min, max: c.params.max })
    : t('playbook.followup', { fast: c.params.fast, slow: c.params.slow });
}

export function PlaybookCard(props: { context: 'brief' | 'insights' | 'create'; compact?: boolean }) {
  const [on] = useFeature('feature_playbook');
  return on ? <PlaybookCardInner {...props} /> : null;
}
function PlaybookCardInner({ context, compact = false }: { context: 'brief' | 'insights' | 'create'; compact?: boolean }) {
  const { t } = useTranslation(); const text = usePlaybookText();
  const { data } = useQuery({ queryKey: ['playbook', context], staleTime: 60 * 60_000,
    queryFn: async () => { const { data, error } = await supabase.rpc('playbook_cards' as never, { _context: context } as never); if (error) throw error; return (data ?? []) as unknown as Card[]; } });
  if (!data?.length) return null;
  const sample = data.some(c => c.sample);
  // Signed-in screens never show sample data: hide until real patterns exist.
  if (sample) return null;
  return <section className={`panel playbook-card${compact ? ' is-compact' : ''}`} aria-label={t('playbook.title')}>
    <div className="playbook-head"><span className="playbook-icon" aria-hidden="true"><Sparkles /></span><span className="eyebrow">{t('playbook.title')}</span>{sample && <span className="chip sample-badge">{t('common.sample')}</span>}</div>
    <ul className="playbook-list">{data.map((c, i) => <li key={i}>{text(c)}</li>)}</ul>
    {!compact && <p className="playbook-note">{sample ? t('playbook.sampleNote') : t('playbook.realNote')}</p>}
  </section>;
}

export function BenchmarkPanel({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const { data } = useQuery({ queryKey: ['benchmark', teamId], staleTime: 30 * 60_000,
    queryFn: async () => { const { data, error } = await supabase.rpc('team_benchmark' as never, { _root: teamId } as never); if (error) throw error; return data as unknown as Bench; } });
  if (!data || data.sample) return null;
  const rows: { key: 'avg' | 'showup'; team: number; net: number; unit: string }[] = [
    { key: 'avg', team: Number(data.team.avg_checkins), net: Number(data.network.avg_checkins), unit: '' },
    { key: 'showup', team: Number(data.team.showup), net: Number(data.network.showup), unit: '%' },
  ];
  const f = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 });
  return <section className="panel benchmark-panel"><div className="section-heading"><div><h2>{t('playbook.benchTitle')}</h2><p>{t('playbook.benchText')}</p></div>{data.sample && <span className="chip sample-badge">{t('common.sample')}</span>}</div>
    <ul className="bench-list">{rows.map(r => { const max = Math.max(r.team, r.net, 1); return <li key={r.key}>
      <span className="bench-label">{t(`playbook.bench.${r.key}`)}</span>
      <div className="bench-bar"><span>{t('playbook.yourTeam')}</span><meter min={0} max={max} value={r.team} aria-label={t('playbook.yourTeam')} /><strong>{f(r.team)}{r.unit}</strong></div>
      <div className="bench-bar is-net"><span>{t('playbook.network')}</span><meter min={0} max={max} value={r.net} aria-label={t('playbook.network')} /><strong>{f(r.net)}{r.unit}</strong></div>
    </li>; })}</ul>
    <p className="playbook-note">{t('playbook.benchFoot', { count: data.team.gatherings })}</p>
  </section>;
}
