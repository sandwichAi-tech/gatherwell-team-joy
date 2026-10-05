import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, LocateFixed, MapPin, Globe2, CalendarDays, UserRound, UsersRound } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { loadMaps, useMapsKey } from '@/lib/maps-client';
import { teamKey, teamTreeQuery } from '@/lib/team';

export type MapEvent = { id: string; team_id: string; title: string; starts_at: string; location_name: string | null; address: string | null; online_url: string | null; lat: number | null; lng: number | null; capacity: number | null; host_id: string; host?: string | null; going?: number };

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const cityOf = (address: string | null) => address?.split(',').slice(-2, -1)[0]?.trim() || address?.split(',')[0]?.trim() || null;

export function RealMap<T extends { lat: number | null; lng: number | null; title: string }>({ apiKey, events, onPick }: { apiKey: string; events: T[]; onPick: (e: T) => void }) {
  const ref = useRef<HTMLDivElement>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let markers: any[] = [];
    loadMaps(apiKey).then(() => {
      if (!ref.current) return;
      const g = window.google.maps; const pts = events.filter(e => e.lat != null && e.lng != null);
      const map = new g.Map(ref.current, { center: pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: 19.43, lng: -99.13 }, zoom: 11, disableDefaultUI: true, zoomControl: true });
      const bounds = new g.LatLngBounds();
      markers = pts.map(e => { const m = new g.Marker({ position: { lat: e.lat, lng: e.lng }, map, title: e.title }); m.addListener('click', () => onPick(e)); bounds.extend(m.getPosition()); return m; });
      if (pts.length > 1) map.fitBounds(bounds);
    }).catch(() => setFailed(true));
    return () => markers.forEach(m => m.setMap(null));
  }, [apiKey, events, onPick]);
  return failed ? <MapPlaceholder /> : <div ref={ref} className="map-canvas" />;
}

export function MapPlaceholder() {
  const { t } = useTranslation();
  return <div className="map-canvas map-placeholder" role="img" aria-label={t('map.placeholder')}><MapPin /><span>{t('map.placeholder')}</span></div>;
}

export function MapPage() {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const rootId = workspace?.teamId ?? '';
  const { data: tree = [] } = useQuery({ ...teamTreeQuery(rootId), enabled: !!rootId });
  const mapsKey = useMapsKey();
  const ids = tree.map(n => n.id);
  const { data: events = [] } = useQuery({
    queryKey: [...teamKey(rootId), 'map', ids.join(',')], enabled: ids.length > 0,
    queryFn: async (): Promise<MapEvent[]> => {
      const { data, error } = await supabase.from('events').select('id, team_id, title, starts_at, location_name, address, online_url, lat, lng, capacity, host_id')
        .in('team_id', ids).eq('status', 'published').gte('starts_at', new Date().toISOString()).order('starts_at').limit(100);
      if (error) throw error;
      const hostIds = [...new Set((data ?? []).map(e => e.host_id))];
      const { data: hosts } = hostIds.length ? await supabase.from('profiles').select('id, full_name').in('id', hostIds) : { data: [] };
      return Promise.all((data ?? []).map(async e => ({ ...e, host: hosts?.find(h => h.id === e.host_id)?.full_name ?? null, going: (await supabase.rpc('event_going_count', { _event_id: e.id })).data ?? 0 })));
    },
  });
  const [when, setWhen] = useState<'week' | 'month'>('month'); const [mode, setMode] = useState<'all' | 'person' | 'online'>('all'); const [team, setTeam] = useState('all');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [picked, setPicked] = useState<MapEvent | null>(null);
  const filtered = useMemo(() => {
    const limit = Date.now() + (when === 'week' ? 7 : 31) * 86400000;
    const list = events.filter(e => new Date(e.starts_at).getTime() <= limit && (team === 'all' || e.team_id === team)
      && (mode === 'all' || (mode === 'online' ? !!e.online_url && !e.location_name && !e.address : !!(e.location_name || e.address))));
    if (!me) return list;
    return [...list].sort((a, b) => (a.lat != null && a.lng != null ? km(me, { lat: a.lat, lng: a.lng }) : 1e9) - (b.lat != null && b.lng != null ? km(me, { lat: b.lat, lng: b.lng }) : 1e9));
  }, [events, when, mode, team, me]);
  const nearMe = () => {
    if (!navigator.geolocation) { toast.error(t('map.noLocation')); return; }
    navigator.geolocation.getCurrentPosition(p => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }), () => toast.error(t('map.noLocation')), { timeout: 10000 });
  };
  if (!workspace) return null;
  if (workspace.role !== 'leader') return <section className="panel"><h2>{t('insights.leadersOnly')}</h2></section>;
  const teamName = (id: string) => tree.find(n => n.id === id)?.name;
  return <>
    <Link to="/team" className="auth-link back-link"><ArrowLeft />{workspace.name}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('map.eyebrow')}</span><h1>{t('map.title')}</h1><p>{t('map.subtitle')}</p></div></div>
    <div className="insights-filters">
      <div className="segmented" role="group" aria-label={t('map.when')}>{(['week', 'month'] as const).map(w => <Button key={w} variant="ghost" className={when === w ? 'selected' : ''} aria-pressed={when === w} onClick={() => setWhen(w)}>{t(`map.${w}`)}</Button>)}</div>
      <div className="segmented" role="group" aria-label={t('map.format')}>{(['all', 'person', 'online'] as const).map(m => <Button key={m} variant="ghost" className={mode === m ? 'selected' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`map.${m}`)}</Button>)}</div>
      {tree.length > 1 && <Select value={team} onValueChange={setTeam}><SelectTrigger className="team-switcher scope-select" aria-label={t('insights.scope')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('insights.wholeOrg')}</SelectItem>{tree.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select>}
      <Button variant="secondary" onClick={nearMe} aria-pressed={!!me}><LocateFixed />{t('map.nearMe')}</Button>
    </div>
    <section className="panel map-panel">{mapsKey ? <RealMap apiKey={mapsKey} events={filtered} onPick={setPicked} /> : <MapPlaceholder />}</section>
    <section className="panel"><div className="section-heading"><h2>{t('map.list', { count: filtered.length })}</h2></div>
      {filtered.length ? <div className="event-list">{filtered.map(e => <button type="button" key={e.id} className="event-row event-button" onClick={() => setPicked(e)}>
        <div className="date-tile"><span>{new Date(e.starts_at).toLocaleDateString(lang, { month: 'short' })}</span><strong>{new Date(e.starts_at).getDate()}</strong></div>
        <div className="event-info"><h3>{e.title}</h3><p>{e.location_name || e.address ? <><MapPin className="inline-icon" />{[cityOf(e.address), e.address ?? e.location_name].filter(Boolean).join(' · ')}</> : <><Globe2 className="inline-icon" />{t('teamSpace.online')}</>}</p>
          <p>{teamName(e.team_id)}{me && e.lat != null && e.lng != null ? ` · ${t('map.distance', { km: km(me, { lat: e.lat, lng: e.lng }).toFixed(1) })}` : ''}</p></div></button>)}</div>
        : <p className="auth-subtitle">{t('map.empty')}</p>}</section>
    <ResponsiveSheet open={!!picked} onOpenChange={o => !o && setPicked(null)} title={picked?.title ?? ''}>
      {picked && <div className="edit-form"><ul className="detail-facts">
        <li><CalendarDays />{new Date(picked.starts_at).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>
        <li><UserRound />{picked.host ?? t('teamSpace.someone')}</li>
        <li><MapPin />{picked.address ?? picked.location_name ?? t('teamSpace.online')}</li>
        <li><UsersRound />{picked.capacity ? t('sampleEvents.registered', { count: picked.going ?? 0, total: picked.capacity }) : t('map.going', { count: picked.going ?? 0 })}</li></ul>
        <Button asChild className="onboarding-continue"><Link to="/event/$id" params={{ id: picked.id }}>{t('map.view')}<ArrowRight /></Link></Button></div>}
    </ResponsiveSheet>
  </>;
}
