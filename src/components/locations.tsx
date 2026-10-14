import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { BrandImage } from '@/components/brand-image';
import { GatheringCover } from '@/components/gathering-cover';
import { CropFileInput } from '@/components/image-crop';
import { FollowButton } from '@/components/follow';
import { confirmAction } from '@/components/confirm-dialog';
import { useGatherwell } from '@/components/gatherwell-shell';
import { publicLocationPhotos } from '@/lib/locations.functions';
import { uploadMedia, mediaUrl, initialsOf } from '@/lib/account';
import { formatMoney } from '@/lib/billing';
import { formatWhen } from '@/lib/guest';

export type LocationMode = 'linked' | 'simple';
type Slot = { day: number; time: string; title: string };
type Row = { id: string; slug: string; mode: LocationMode; name: string; address: string; photos: string[]; booking_url: string | null; store_url: string | null; opening_notes: string; schedule: Slot[]; capacity: number | null; dropin_cents: number | null };
type Upcoming = { id: string; title: string; starts_at: string; timezone: string; location_name: string | null; online: boolean; cover_style: number | null; capacity: number | null; members_only: boolean; price_cents: number | null };
type PublicLoc = Omit<Row, 'photos' | 'schedule'> & { schedule: Slot[]; host_id: string; coaches: { id: string; name: string | null; slug: string | null; avatar_url: string | null }[]; followers: number; following: boolean; upcoming: Upcoming[] };
export type LocationListItem = { id: string; slug: string; mode: LocationMode; name: string; address: string; host_name: string | null; upcoming: number };

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const dayName = (d: number, lang: string) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d)));
const slugify = (s: string) => `${s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'space'}-${Math.random().toString(36).slice(2, 6)}`;
const okUrl = (u: string) => !u || /^https:\/\/[^\s]+\.[^\s]+/i.test(u);

export const publicLocationsQuery = () => ({ queryKey: ['public-locations'], queryFn: async () => { const { data, error } = await supabase.rpc('list_public_locations'); if (error) throw error; return (data ?? []) as unknown as LocationListItem[]; } });

/* ---------- Host tools: manage locations ---------- */

export function LocationsPage() {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const q = useQuery({ queryKey: ['my-locations', userId], queryFn: async () => { const { data, error } = await supabase.from('locations').select('*').eq('host_id', userId).order('created_at'); if (error) throw error; return data as unknown as Row[]; } });
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('locations.eyebrow')}</span><h1>{t('locations.title')}</h1></div>
      <Button onClick={() => setEdit('new')}><GwIcon name="Plus" />{t('locations.add')}</Button></div>
    <p className="auth-subtitle">{t('locations.intro')}</p>
    {q.isLoading ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data?.length
      ? <section className="panel"><EmptyState icon="MapPin" title={t('locations.emptyTitle')} text={t('locations.empty')} action={<Button onClick={() => setEdit('new')}>{t('locations.add')}</Button>} /></section>
      : q.data.map(l => <section key={l.id} className="panel loc-row">
          <GwFeatureTile name={l.mode === 'linked' ? 'CalendarDays' : 'Home'} size={24} />
          <span className="loc-row-text"><strong>{l.name}</strong><small>{t(`locations.mode_${l.mode}`)}{l.address ? ` · ${l.address}` : ''}</small></span>
          <span className="loc-row-actions"><Button asChild variant="secondary"><Link to="/l/$slug" params={{ slug: l.slug }}>{t('locations.view')}</Link></Button><Button variant="ghost" size="icon" aria-label={t('locations.edit')} onClick={() => setEdit(l)}><GwIcon name="Pencil" /></Button></span>
        </section>)}
    {edit && <LocationEditor key={edit === 'new' ? 'new' : edit.id} initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
  </>;
}

function LocationEditor({ initial, onClose }: { initial: Row | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const [mode, setMode] = useState<LocationMode>(initial?.mode ?? 'simple');
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [booking, setBooking] = useState(initial?.booking_url ?? '');
  const [store, setStore] = useState(initial?.store_url ?? '');
  const [notes, setNotes] = useState(initial?.opening_notes ?? '');
  const [schedule, setSchedule] = useState<Slot[]>(initial?.schedule ?? []);
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : '');
  const [dropin, setDropin] = useState(initial?.dropin_cents != null ? (initial.dropin_cents / 100).toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const mine = useQuery({ queryKey: ['my-upcoming-for-location', userId], queryFn: async () => { const { data } = await supabase.from('events').select('id, title, starts_at, location_id').eq('host_id', userId).gt('starts_at', new Date().toISOString()).order('starts_at').limit(30); return data ?? []; }, enabled: !!initial });

  const addPhoto = async (file: File) => {
    try { const path = await uploadMedia(userId, file, 'cover', `${userId}/location-${Date.now()}.webp`); setPhotos(p => [...p, path].slice(0, 6)); }
    catch { toast.error(t('error.message')); }
  };
  const save = async () => {
    if (name.trim().length < 2) { toast.error(t('locations.needName')); return; }
    if (!okUrl(booking) || !okUrl(store)) { toast.error(t('locations.badUrl')); return; }
    if (mode === 'linked' && !booking) { toast.error(t('locations.needBooking')); return; }
    setBusy(true);
    const row = { mode, name: name.trim(), address: address.trim(), photos, booking_url: mode === 'linked' ? booking.trim() || null : null, store_url: mode === 'simple' ? store.trim() || null : null,
      opening_notes: mode === 'simple' ? notes.trim() : '', schedule: mode === 'simple' ? schedule.filter(s => s.title.trim() && s.time) : [],
      capacity: mode === 'simple' && capacity ? Math.max(1, Math.round(Number(capacity))) : null, dropin_cents: mode === 'simple' && dropin !== '' ? Math.max(0, Math.round(Number(dropin) * 100)) : null };
    const { error } = initial ? await supabase.from('locations').update({ ...row, updated_at: new Date().toISOString() }).eq('id', initial.id)
      : await supabase.from('locations').insert({ ...row, host_id: userId, slug: slugify(name) });
    setBusy(false);
    if (error) { toast.error(t('error.message')); return; }
    toast.success(t('locations.saved')); void qc.invalidateQueries({ queryKey: ['my-locations'] }); onClose();
  };
  const remove = async () => {
    if (!initial || !(await confirmAction({ title: t('locations.deleteTitle'), body: t('locations.deleteBody'), confirmLabel: t('locations.delete'), destructive: true }))) return;
    const { error } = await supabase.from('locations').delete().eq('id', initial.id);
    if (error) { toast.error(t('error.message')); return; }
    void qc.invalidateQueries({ queryKey: ['my-locations'] }); onClose();
  };
  const link = async (eventId: string, on: boolean) => {
    if (!initial) return;
    const { error } = await supabase.rpc('set_event_location', { _event: eventId, _location: (on ? initial.id : null) as string });
    if (error) toast.error(t('error.message')); else void mine.refetch();
  };

  return <ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} icon="MapPin" title={initial ? t('locations.edit') : t('locations.add')}
    footer={<Button className="w-full" disabled={busy} onClick={() => void save()}>{t('locations.save')}</Button>}>
    <div className="loc-form">
      <fieldset className="loc-modes"><legend className="field-label">{t('locations.modeLabel')}</legend>
        {(['linked', 'simple'] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} className={`loc-mode${mode === m ? ' selected' : ''}`} onClick={() => setMode(m)}>
          <GwFeatureTile name={m === 'linked' ? 'CalendarDays' : 'Home'} size={24} /><span><strong>{t(`locations.mode_${m}`)}</strong><small>{t(`locations.modeHint_${m}`)}</small></span></button>)}
      </fieldset>
      <div className="field"><Label htmlFor="loc-name">{t('locations.name')}</Label><Input id="loc-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field"><Label htmlFor="loc-address">{t('locations.address')}</Label><Input id="loc-address" maxLength={200} autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} /></div>
      <div className="field"><span className="field-label">{t('locations.photos')}</span>
        <div className="loc-photo-grid">{photos.map(p => <LocPhoto key={p} path={p} onRemove={() => setPhotos(ps => ps.filter(x => x !== p))} />)}
          {photos.length < 6 && <label className="loc-photo-add"><GwIcon name="ImagePlus" /><span>{t('locations.addPhoto')}</span><CropFileInput kind="cover" onCropped={r => void addPhoto(r.file)} /></label>}</div></div>
      {mode === 'linked' ? <div className="field"><Label htmlFor="loc-book">{t('locations.bookingUrl')}</Label><Input id="loc-book" type="url" inputMode="url" placeholder="https://" value={booking} onChange={e => setBooking(e.target.value)} /><p className="field-hint">{t('locations.bookingHint')}</p></div>
        : <>
          <div className="field"><Label htmlFor="loc-notes">{t('locations.openingNotes')}</Label><Textarea id="loc-notes" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('locations.openingPlaceholder')} /></div>
          <div className="field"><span className="field-label">{t('locations.schedule')}</span>
            {schedule.map((s, i) => <div key={i} className="loc-slot">
              <select aria-label={t('locations.day')} value={s.day} onChange={e => setSchedule(x => x.map((y, j) => j === i ? { ...y, day: Number(e.target.value) } : y))}>{DAYS.map(d => <option key={d} value={d}>{dayName(d, lang)}</option>)}</select>
              <Input aria-label={t('locations.time')} type="time" value={s.time} onChange={e => setSchedule(x => x.map((y, j) => j === i ? { ...y, time: e.target.value } : y))} />
              <Input aria-label={t('locations.slotTitle')} maxLength={60} placeholder={t('locations.slotPlaceholder')} value={s.title} onChange={e => setSchedule(x => x.map((y, j) => j === i ? { ...y, title: e.target.value } : y))} />
              <Button variant="ghost" size="icon" aria-label={t('locations.removeSlot')} onClick={() => setSchedule(x => x.filter((_, j) => j !== i))}><GwIcon name="Trash2" /></Button></div>)}
            {schedule.length < 30 && <Button variant="secondary" onClick={() => setSchedule(x => [...x, { day: 1, time: '07:00', title: '' }])}><GwIcon name="Plus" />{t('locations.addSlot')}</Button>}</div>
          <div className="loc-two"><div className="field"><Label htmlFor="loc-cap">{t('locations.capacity')}</Label><Input id="loc-cap" type="number" min={1} max={1000} inputMode="numeric" value={capacity} onChange={e => setCapacity(e.target.value)} /></div>
            <div className="field"><Label htmlFor="loc-drop">{t('locations.dropin')}</Label><Input id="loc-drop" type="number" min={0} step="0.01" inputMode="decimal" value={dropin} onChange={e => setDropin(e.target.value)} /></div></div>
          <p className="field-hint">{t('locations.simpleHint')}</p>
          <div className="field"><Label htmlFor="loc-store">{t('locations.storeUrl')}</Label><Input id="loc-store" type="url" inputMode="url" placeholder="https://" value={store} onChange={e => setStore(e.target.value)} /><p className="field-hint">{t('locations.storeHint')}</p></div>
        </>}
      {initial && <div className="field"><span className="field-label">{t('locations.linkGatherings')}</span>
        {mine.data?.length ? mine.data.map(e => <label key={e.id} className="loc-link-row"><input type="checkbox" checked={e.location_id === initial.id} onChange={ev => void link(e.id, ev.target.checked)} /><span><strong>{e.title}</strong><small>{formatWhen(e.starts_at, lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span></label>)
          : <p className="field-hint">{t('locations.noGatherings')}</p>}</div>}
      {initial && <Button variant="ghost" className="loc-delete" onClick={() => void remove()}><GwIcon name="Trash2" />{t('locations.delete')}</Button>}
    </div>
  </ResponsiveSheet>;
}

function LocPhoto({ path, onRemove }: { path: string; onRemove: () => void }) {
  const { t } = useTranslation();
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), staleTime: 50 * 60 * 1000 });
  return <span className="loc-photo">{url && <img src={url} alt="" loading="lazy" decoding="async" />}<button type="button" aria-label={t('locations.removePhoto')} onClick={onRemove}><GwIcon name="X" /></button></span>;
}

/* ---------- Public page /l/:slug ---------- */

export const publicLocationQuery = (slug: string) => ({ queryKey: ['public-location', slug], queryFn: async () => { const { data, error } = await supabase.rpc('get_public_location', { _slug: slug }); if (error) throw error; return data as unknown as PublicLoc | null; } });
export function LocationPublicPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useQuery(publicLocationQuery(slug));
  const photos = useQuery({ queryKey: ['public-location-photos', slug], queryFn: () => publicLocationPhotos({ data: { slug } }), staleTime: 50 * 60 * 1000 });
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const l = q.data;
  if (!l) return <EmptyState icon="MapPin" title={t('locations.notFoundTitle')} text={t('locations.notFound')} action={<Button asChild variant="secondary"><Link to="/discover">{t('follow.discover')}</Link></Button>} />;
  const pics = photos.data ?? [];
  const byDay = DAYS.map(d => ({ d, slots: l.schedule.filter(s => s.day === d).sort((a, b) => a.time.localeCompare(b.time)) })).filter(x => x.slots.length);
  const time = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, h ?? 0, m ?? 0))); };
  return <div className="follow-page loc-page">
    <section className="gw-hero-card follow-hero">
      {pics[0] ? <BrandImage src={pics[0]} alt={l.name} className="gw-hero-cover profile-photo-cover" priority /> : <BrandImage slot="host_band" alt="" className="gw-hero-cover" />}
      <div className="follow-hero-body">
        <p className="eyebrow">{t(`locations.mode_${l.mode}`)}</p>
        <h1 className="follow-name">{l.name}</h1>
        <p className="follow-meta">{[l.address, t('follow.followers', { count: l.followers })].filter(Boolean).join(' · ')}</p>
        <div className="follow-actions"><FollowButton kind="location" target={l.id} following={l.following} slug={slug} />
          {l.booking_url && <Button asChild><a href={l.booking_url} target="_blank" rel="noopener noreferrer"><GwIcon name="CalendarDays" />{t('locations.bookClass')}</a></Button>}
          {l.store_url && <Button asChild variant="secondary"><a href={l.store_url} target="_blank" rel="noopener noreferrer"><GwIcon name="ExternalLink" />{t('locations.ourStore')}</a></Button>}</div>
      </div>
    </section>
    {pics.length > 1 && <section className="loc-gallery" aria-label={t('locations.photos')}>{pics.slice(1).map((u, i) => <img key={u} src={u} alt={t('locations.photoAlt', { name: l.name, n: i + 2 })} loading="lazy" decoding="async" />)}</section>}
    {l.mode === 'linked' && <section className="panel"><p className="loc-note">{t('locations.linkedNote')}</p></section>}
    {l.mode === 'simple' && (l.opening_notes || l.capacity || l.dropin_cents != null) && <section className="panel loc-facts">
      {l.opening_notes && <p className="loc-note"><GwIcon name="Clock" />{l.opening_notes}</p>}
      <div className="loc-chips">{l.capacity && <span className="chip">{t('locations.roomFor', { count: l.capacity })}</span>}
        {l.dropin_cents != null && <span className="chip">{l.dropin_cents === 0 ? t('locations.dropinFree') : t('locations.dropinPrice', { price: formatMoney(l.dropin_cents, lang) })}</span>}
        <span className="chip"><GwIcon name="QrCode" />{t('locations.qrDoor')}</span></div>
    </section>}
    {byDay.length > 0 && <section className="panel"><h2>{t('locations.weekly')}</h2>
      <ul className="loc-schedule">{byDay.map(({ d, slots }) => <li key={d}><strong>{dayName(d, lang)}</strong><span>{slots.map((s, i) => <small key={i}>{time(s.time)} · {s.title}</small>)}</span></li>)}</ul></section>}
    <section className="panel"><h2>{t('locations.coaches')}</h2>
      <ul className="loc-coaches">{l.coaches.map(c => <li key={c.id}><CoachAvatar path={c.avatar_url} name={c.name} />{c.slug ? <Link to="/h/$slug" params={{ slug: c.slug }}>{c.name}</Link> : <span>{c.name}</span>}</li>)}</ul></section>
    <section className="follow-upcoming"><h2>{t('follow.upcoming')}</h2>
      {l.upcoming.length ? <ul className="follow-list">{l.upcoming.map(e => <li key={e.id}><Link to="/e/$id" params={{ id: e.id }} className="follow-event">
        <GatheringCover style={e.cover_style} title={e.title} className="follow-event-cover" />
        <span><strong>{e.title}</strong><small>{formatWhen(e.starts_at, lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: e.timezone || undefined })}</small>
          <small>{[e.members_only ? t('locations.membersFirst') : null, e.capacity ? t('locations.spots', { count: e.capacity }) : null].filter(Boolean).join(' · ')}</small></span>
        <GwIcon name="ChevronRight" /></Link></li>)}</ul> : <EmptyState compact icon="CalendarDays" text={t('locations.noUpcoming')} />}
    </section>
    <section className="panel"><h2>{t('locations.map')}</h2>
      <div className="map-canvas map-placeholder" role="img" aria-label={t('map.placeholder')}><GwIcon name="MapPin" /><span>{l.address || t('map.placeholder')}</span><small>{t('locations.mapSoon')}</small></div>
      {l.address && <Button asChild variant="secondary"><a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(l.address)}`} target="_blank" rel="noopener noreferrer"><GwIcon name="ExternalLink" />{t('locations.directions')}</a></Button>}
    </section>
    <p className="field-hint loc-fine">{t('locations.fine')}</p>
  </div>;
}

function CoachAvatar({ path, name }: { path: string | null; name: string | null }) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  return url ? <img src={url} alt="" className="loc-coach-avatar" width={40} height={40} loading="lazy" /> : <span className="loc-coach-avatar is-initials" aria-hidden>{initialsOf(name)}</span>;
}

/* ---------- Discover card ---------- */

export function LocationCard({ l }: { l: LocationListItem }) {
  const { t } = useTranslation();
  return <Link to="/l/$slug" params={{ slug: l.slug }} className="gw-card loc-card">
    <GwFeatureTile name={l.mode === 'linked' ? 'CalendarDays' : 'Home'} size={24} />
    <span className="loc-card-text"><strong>{l.name}</strong><small>{l.address}</small>
      <small>{[l.host_name, t('locations.upcomingCount', { count: l.upcoming })].filter(Boolean).join(' · ')}</small></span>
    <GwIcon name="ChevronRight" />
  </Link>;
}
