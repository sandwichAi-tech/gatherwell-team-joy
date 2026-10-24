import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGatherwell } from '@/components/gatherwell-shell';
import { alertsQuery, alertMatchesQuery, type LocationAlert } from '@/lib/discovery';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { confirmAction } from '@/components/confirm-dialog';
import { GwIcon } from '@/components/gw-icon';

const RADIUS = [25, 50, 100, 250];
const KINDS = ['event', 'course', 'download', 'membership'] as const;

function AlertEditor({ userId, alert, onClose }: { userId: string; alert: Partial<LocationAlert> | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [a, setA] = useState<Partial<LocationAlert> | null>(alert);
  const [busy, setBusy] = useState(false);
  const useBrowserLocation = () => {
    if (!navigator.geolocation) { toast.error(t('alerts.noGeo')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setA(prev => prev && { ...prev, lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 }),
      () => toast.error(t('alerts.geoDenied')),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  };
  const save = async () => {
    if (!a) return;
    setBusy(true);
    const row = {
      user_id: userId,
      label: a.label || null,
      city: a.city || null,
      region: a.region || null,
      country: a.country || null,
      lat: a.lat ?? null,
      lng: a.lng ?? null,
      radius_km: a.radius_km ?? 50,
      categories: a.categories ?? [],
      kinds: a.kinds ?? [],
      language: a.language ?? null,
      frequency: a.frequency ?? 'weekly',
      paused: a.paused ?? false,
      updated_at: new Date().toISOString(),
    };
    const { error } = a.id
      ? await supabase.from('location_alerts').update(row).eq('id', a.id).eq('user_id', userId)
      : await supabase.from('location_alerts').insert(row);
    setBusy(false);
    if (error) { toast.error(t('error.message')); return; }
    toast.success(t('alerts.saved'));
    await qc.invalidateQueries({ queryKey: ['location-alerts', userId] });
    await qc.invalidateQueries({ queryKey: ['alert-matches', userId] });
    onClose();
  };
  if (!a) return null;
  const kinds = a.kinds ?? [];
  return <ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} title={t(a.id ? 'alerts.edit' : 'alerts.new')} description={t('alerts.editorText')}
    footer={<Button className="w-full" disabled={busy} onClick={() => void save()}>{t('common.save')}</Button>}>
    <div className="form-grid">
      <div className="field"><Label htmlFor="al-label">{t('alerts.label')}</Label><Input id="al-label" value={a.label ?? ''} onChange={e => setA({ ...a, label: e.target.value })} placeholder={t('alerts.labelPlaceholder')} /></div>
      <div className="field"><Label htmlFor="al-city">{t('alerts.city')}</Label><Input id="al-city" value={a.city ?? ''} onChange={e => setA({ ...a, city: e.target.value })} placeholder={t('alerts.cityPlaceholder')} /></div>
      <div className="field"><Label htmlFor="al-region">{t('alerts.region')}</Label><Input id="al-region" value={a.region ?? ''} onChange={e => setA({ ...a, region: e.target.value })} /></div>
      <div className="field">
        <Label>{t('alerts.approxLocation')}</Label>
        <p className="muted-small">{t('alerts.coarseNote')}</p>
        <Button type="button" variant="secondary" onClick={useBrowserLocation}><GwIcon name="MapPin" />{a.lat != null ? t('alerts.locationSet', { lat: a.lat.toFixed(1), lng: (a.lng ?? 0).toFixed(1) }) : t('alerts.useMyLocation')}</Button>
        {a.lat != null && <Button type="button" variant="ghost" onClick={() => setA({ ...a, lat: null, lng: null })}>{t('alerts.clearLocation')}</Button>}
      </div>
      <div className="field"><Label>{t('alerts.radius')}</Label>
        <div className="chip-row">{RADIUS.map(r => <button key={r} type="button" className={`chip${(a.radius_km ?? 50) === r ? ' selected' : ''}`} aria-pressed={(a.radius_km ?? 50) === r} onClick={() => setA({ ...a, radius_km: r })}>{t('discover.km', { km: r })}</button>)}</div>
      </div>
      <div className="field"><Label>{t('alerts.kinds')}</Label>
        <div className="chip-row">{KINDS.map(k => <button key={k} type="button" className={`chip${kinds.includes(k) ? ' selected' : ''}`} aria-pressed={kinds.includes(k)}
          onClick={() => setA({ ...a, kinds: kinds.includes(k) ? kinds.filter(x => x !== k) : [...kinds, k] })}>{t(`discover.kind.${k}`)}</button>)}</div>
      </div>
      <div className="field"><Label htmlFor="al-lang">{t('alerts.language')}</Label>
        <select id="al-lang" className="input" value={a.language ?? ''} onChange={e => setA({ ...a, language: e.target.value || null })}>
          <option value="">{t('alerts.anyLanguage')}</option><option value="en">English</option><option value="es">Español</option>
        </select>
      </div>
      <div className="field"><Label htmlFor="al-freq">{t('alerts.frequency')}</Label>
        <select id="al-freq" className="input" value={a.frequency ?? 'weekly'} onChange={e => setA({ ...a, frequency: e.target.value as LocationAlert['frequency'] })}>
          <option value="instant">{t('alerts.freq.instant')}</option><option value="daily">{t('alerts.freq.daily')}</option><option value="weekly">{t('alerts.freq.weekly')}</option>
        </select>
        <p className="muted-small">{t('alerts.deliveryNote')}</p>
      </div>
    </div>
  </ResponsiveSheet>;
}

export function AlertsPage() {
  const { userId } = useGatherwell();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const qc = useQueryClient();
  const alerts = useQuery(alertsQuery(userId));
  const matches = useQuery(alertMatchesQuery(userId));
  const [editing, setEditing] = useState<Partial<LocationAlert> | null>(null);

  const setPaused = async (a: LocationAlert, paused: boolean) => {
    const { error } = await supabase.from('location_alerts').update({ paused, updated_at: new Date().toISOString() }).eq('id', a.id).eq('user_id', userId);
    if (error) { toast.error(t('error.message')); return; }
    await qc.invalidateQueries({ queryKey: ['location-alerts', userId] });
    await qc.invalidateQueries({ queryKey: ['alert-matches', userId] });
  };
  const remove = async (a: LocationAlert) => {
    if (!(await confirmAction({ title: t('alerts.deleteConfirm'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const { error } = await supabase.from('location_alerts').delete().eq('id', a.id).eq('user_id', userId);
    if (error) { toast.error(t('error.message')); return; }
    toast.success(t('alerts.deleted'));
    await qc.invalidateQueries({ queryKey: ['location-alerts', userId] });
    await qc.invalidateQueries({ queryKey: ['alert-matches', userId] });
  };

  if (alerts.isPending) return <ListSkeleton />;
  if (alerts.isError) return <RetryState retry={() => void alerts.refetch()} />;
  const list = alerts.data ?? [];
  const matched = matches.data ?? [];

  return <main className="page">
    <div className="page-heading"><div><span className="eyebrow">{t('alerts.eyebrow')}</span><h1>{t('alerts.title')}</h1><p>{t('alerts.sentence')}</p></div>
      <Button variant="secondary" onClick={() => setEditing({ radius_km: 50, frequency: 'weekly' })}><GwIcon name="Plus" />{t('alerts.new')}</Button></div>

    {matched.length > 0 && <section className="panel" aria-label={t('alerts.matchesTitle')}>
      <div className="section-heading"><h2>{t('alerts.matchesTitle')}</h2></div>
      <ul className="offer-list">{matched.map((m, i) => <li key={`${m.alert_id}:${m.offering.id}:${i}`} className="offer-row">
        <div className="offer-row-main"><strong>{m.offering.title}</strong>
          <small>{t(`discover.kind.${m.offering.kind}`)} · {m.alert_label}{m.offering.starts_at ? ` · ${new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(m.offering.starts_at))}` : ''}</small></div>
        <Button asChild variant="secondary" size="sm">{m.offering.kind === 'event'
          ? <Link to="/e/$id" params={{ id: m.offering.id }}>{t('alerts.view')}</Link>
          : <Link to="/o/$id" params={{ id: m.offering.id }}>{t('alerts.view')}</Link>}</Button>
      </li>)}</ul>
    </section>}

    {list.length === 0 ? <EmptyState icon="Bell" title={t('alerts.emptyTitle')} text={t('alerts.empty')} action={<Button onClick={() => setEditing({ radius_km: 50, frequency: 'weekly' })}>{t('alerts.new')}</Button>} />
      : <ul className="offer-list">{list.map(a => <li key={a.id} className="panel offer-row">
          <div className="offer-row-main"><strong>{a.label || a.city || t('alerts.untitled')}</strong>
            <small>{[a.city, a.region].filter(Boolean).join(', ') || t('alerts.anywhere')} · {t('discover.km', { km: a.radius_km })}{a.kinds.length ? ` · ${a.kinds.map(k => t(`discover.kind.${k}`)).join(', ')}` : ''} · {t(`alerts.freq.${a.frequency}`)}</small></div>
          <div className="offer-row-actions">
            <label className="switch-row"><Switch checked={!a.paused} onCheckedChange={on => void setPaused(a, !on)} aria-label={t(a.paused ? 'alerts.resume' : 'alerts.pause')} /><span className="muted-small">{t(a.paused ? 'alerts.paused' : 'alerts.active')}</span></label>
            <Button variant="secondary" size="icon" aria-label={t('alerts.edit')} onClick={() => setEditing(a)}><GwIcon name="Pencil" /></Button>
            <Button variant="ghost" size="icon" aria-label={t('alerts.delete')} onClick={() => void remove(a)}><GwIcon name="Trash2" /></Button>
          </div>
        </li>)}</ul>}
    <p className="gw-fine"><GwIcon name="Bell" size={14} /> {t('alerts.deliveryNote')}</p>
    {editing && <AlertEditor userId={userId} alert={editing} onClose={() => setEditing(null)} />}
  </main>;
}
