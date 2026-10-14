import { PriceGuidance } from '@/components/coach-launch';
import { RetreatEditor, cleanRetreat } from '@/components/retreat';
import { asRetreat, emptyRetreat, type Retreat } from '@/lib/retreat';
import { CATEGORIES, isCategory, type Category } from '@/lib/landing';
import { CropFileInput, type CropResult } from '@/components/image-crop';
import { CopyButton } from '@/components/copy-button';
import { PlaybookCard } from '@/components/playbook';
import { trackEvent } from '@/lib/analytics';
import { ClaimGuard } from '@/components/smart';
import { useTranslateFill } from '@/lib/assistant-client';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Camera, Check, Languages, Copy, MessageCircle, MessageSquareText, MapPin, Globe2, Repeat, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia, workspaceQuery } from '@/lib/account';
import { ShareKit } from '@/components/share-kit';
import { COVER_STYLES, datePresets, isOnline, rpcError, shareLink, toLocalInput, usualSlot, expandRepeat, REPEATS, type Repeat as RepeatKind, type RepeatRule } from '@/lib/gatherings';
import { useMapsKey, loadMaps } from '@/lib/maps-client';
import { checklistOf, eventDetailQuery, templatesQuery } from '@/lib/templates';
import { UpgradeSheet } from '@/components/plan-page';
import { planStatusQuery } from '@/lib/billing';

type Props = { eventId?: string | undefined; templateId?: string | undefined; fromId?: string | undefined };
const DURATIONS = [30, 60, 90, 120] as const;

export function GatheringForm({ eventId, templateId, fromId }: Props) {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const navigate = useNavigate(); const router = useRouter(); const queryClient = useQueryClient();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const editing = !!eventId;
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: planStatus } = useQuery(planStatusQuery(userId));
  const { data: templates = [] } = useQuery({ ...templatesQuery(), enabled: !!templateId });
  const sourceId = eventId ?? fromId;
  const { data: source } = useQuery({ ...eventDetailQuery(sourceId ?? ''), enabled: !!sourceId });
  const mapsKey = useMapsKey();
  const { data: history = [] } = useQuery({ queryKey: ['host-slots', userId], enabled: !editing, staleTime: 300000,
    queryFn: async () => (await supabase.from('events').select('starts_at, series_id').eq('host_id', userId).neq('status', 'draft').order('starts_at', { ascending: false }).limit(60)).data ?? [] });

  const [category, setCategory] = useState<Category>('more'); const [categoryLabel, setCategoryLabel] = useState('');
  const [title, setTitle] = useState(''); const [coverPath, setCoverPath] = useState<string | null>(null); const [coverStyle, setCoverStyle] = useState(0);
  const [start, setStart] = useState(''); const [duration, setDuration] = useState<number>(60); const [customDuration, setCustomDuration] = useState(false);
  const [place, setPlace] = useState<'person' | 'online'>('person'); const [locationName, setLocationName] = useState(''); const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null); const [note, setNote] = useState(''); const [url, setUrl] = useState('');
  const [price, setPrice] = useState(''); const [limit, setLimit] = useState<null | 'gatherings' | 'storage'>(null);
  const [capacity, setCapacity] = useState(''); const [communitySeats, setCommunitySeats] = useState(''); const [coverFee, setCoverFee] = useState(false); const [visibility, setVisibility] = useState<'public' | 'team' | 'invite'>('public');
  const [descEn, setDescEn] = useState(''); const [descEs, setDescEs] = useState(''); const [descTab, setDescTab] = useState<'en' | 'es'>(lang);
  const [wholeSeries, setWholeSeries] = useState(false); const [tpl, setTpl] = useState<{ id: string; title: string } | null>(null);
  const tr = useTranslateFill(); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<{ id: string; visibility: string } | null>(null); const [tried, setTried] = useState(false); const [ready, setReady] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);
  // Quick create is the default for brand-new gatherings; templates, duplicates and edits open the full form.
  const [rule, setRule] = useState<RepeatRule>({ kind: 'none', monthly: 'date', days: [], endMode: 'count', count: 8, until: '' });
  const [teamReg, setTeamReg] = useState({ on: false, min: 2, max: 6, mode: 'person' as 'person' | 'team' });
  const [full, setFull] = useState(editing || !!templateId || !!fromId);
  const [retreatOn, setRetreatOn] = useState(false); const [retreat, setRetreat] = useState<Retreat>(emptyRetreat); const [retreatEnd, setRetreatEnd] = useState(''); const [galleryBusy, setGalleryBusy] = useState(false);

  // Prefill once from template, the gathering being edited, or the one being duplicated.
  useEffect(() => {
    if (ready) return;
    if (templateId) {
      const tp = templates.find(x => x.id === templateId); if (!tp) return;
      setTpl({ id: tp.id, title: tp.title }); setTitle(tp.title); setCoverPath(tp.cover_url); setDescEn(tp.description_en ?? ''); setDescEs(tp.description_es ?? '');
      setDuration(tp.default_duration_minutes); setCustomDuration(!DURATIONS.includes(tp.default_duration_minutes as 60)); setCapacity(tp.default_capacity ? String(tp.default_capacity) : '');
      setVisibility(tp.visibility_default === 'team' ? 'team' : 'public'); setStart(toLocalInput(datePresets()[1]!.date)); setReady(true); return;
    }
    if (sourceId) {
      if (!source) return; const e = source.event;
      setCategory(isCategory(e.category) ? e.category : 'more'); setCategoryLabel(e.category_label ?? ''); setTitle(e.title); setCoverPath(e.cover_url); setCoverStyle(e.cover_style ?? 0); setDescEn(e.description_en ?? ''); setDescEs(e.description_es ?? '');
      const mins = e.ends_at ? Math.max(5, Math.round((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000)) : 60;
      setDuration(mins); setCustomDuration(!DURATIONS.includes(mins as 60));
      setPlace(isOnline(e) ? 'online' : 'person'); setLocationName(e.location_name ?? ''); setAddress(e.address ?? ''); setNote(e.meeting_note ?? ''); setUrl(e.online_url ?? '');
      setCoords(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : null);
      setCoverFee(!!(e as { cover_service_fee?: boolean }).cover_service_fee);
      setPrice((e as { price_cents?: number | null }).price_cents ? String(((e as { price_cents: number }).price_cents / 100)) : '');
      { const x = e as { team_registration?: boolean; team_min?: number; team_max?: number; team_price_mode?: string }; setTeamReg({ on: !!x.team_registration, min: x.team_min ?? 2, max: x.team_max ?? 6, mode: x.team_price_mode === 'team' ? 'team' : 'person' }); }
      { const rt = asRetreat((e as { retreat?: unknown }).retreat); if (rt) { setRetreatOn(true); setRetreat(rt); if (e.ends_at) setRetreatEnd(toLocalInput(new Date(e.ends_at))); } }
      setCommunitySeats((e as { community_seats?: number | null }).community_seats ? String((e as { community_seats: number }).community_seats) : '');
      setCapacity(e.capacity ? String(e.capacity) : ''); setVisibility(e.visibility === 'team' ? 'team' : e.visibility === 'invite' ? 'invite' : 'public');
      if (editing) setStart(toLocalInput(new Date(e.starts_at)));
      else { const d = new Date(e.starts_at); const next = new Date(); next.setDate(next.getDate() + 7); next.setHours(d.getHours(), d.getMinutes(), 0, 0); setStart(toLocalInput(next)); }
      if (fromId && e.template_id) setTpl(null);
      setReady(true); return;
    }
    setStart(toLocalInput(datePresets()[1]!.date)); setReady(true);
  }, [ready, templateId, templates, sourceId, source, editing, fromId]);

  // Address becomes places autocomplete once the maps key exists.
  useEffect(() => {
    if (!mapsKey || place !== 'person' || !addressRef.current) return;
    let listener: any;
    loadMaps(mapsKey).then(() => {
      const g = window.google?.maps; if (!g?.places || !addressRef.current) return;
      const ac = new g.places.Autocomplete(addressRef.current, { fields: ['name', 'formatted_address', 'geometry'] });
      listener = ac.addListener('place_changed', () => {
        const p = ac.getPlace(); if (!p) return;
        if (p.formatted_address) setAddress(p.formatted_address);
        if (p.name && !locationName) setLocationName(p.name);
        const loc = p.geometry?.location; if (loc) setCoords({ lat: loc.lat(), lng: loc.lng() });
      });
    }).catch(() => {});
    return () => listener?.remove?.();
  }, [mapsKey, place, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!workspace) return null;
  const canSell = planStatus?.connect_status === 'active';
  const priceCents = price ? Math.round(Number(price) * 100) : null;
  const saveTeamReg = async (id: string) => {
    const { data: ev } = await supabase.from('events').select('series_id').eq('id', id).maybeSingle();
    const q = supabase.from('events').update({ team_registration: teamReg.on, team_min: teamReg.min, team_max: teamReg.max, team_price_mode: teamReg.mode });
    const { error } = ev?.series_id ? await q.eq('series_id', ev.series_id) : await q.eq('id', id);
    if (error) toast.error(t('profile.saveError'));
  };
  const saveRetreat = async (id: string) => {
    if (!retreatOn && !(source?.event as { retreat?: unknown } | undefined)?.retreat) return true;
    const { error } = await supabase.rpc('set_event_retreat', { _event: id, _retreat: (retreatOn ? cleanRetreat(retreat) : null) as never, _ends_at: retreatOn ? new Date(retreatEnd).toISOString() : (null as unknown as string) });
    if (error) { toast.error(t(`retreat.errors.${['blocked_claim', 'invalid_retreat_dates', 'invalid_balance_due', 'invalid_deposit', 'payment_needs_price'].find(k => error.message.includes(k)) ?? 'failed'}`)); return false; }
    return true;
  };
  const uploadGallery = async (file: File) => {
    setGalleryBusy(true);
    try { return await uploadMedia(userId, file, 'cover'); } catch (err) { if (err instanceof Error && err.message === 'storage_limit') setLimit('storage'); else toast.error(t('profile.saveError')); return null; } finally { setGalleryBusy(false); }
  };
  const savePrice = async (id: string) => {
    if (!canSell && !priceCents) return null;
    const { data: ev } = await supabase.from('events').select('series_id').eq('id', id).maybeSingle();
    const q = supabase.from('events').update({ price_cents: priceCents, pass_fee: planStatus?.pass_fee ?? false, cover_service_fee: !!priceCents && coverFee, community_seats: priceCents && Number(communitySeats) > 0 ? Math.min(100, Number(communitySeats)) : null });
    const { error } = ev?.series_id ? await q.eq('series_id', ev.series_id) : await q.eq('id', id);
    return error;
  };
  const teamId = editing && source ? source.event.team_id : workspace.teamId;
  if (!editing && workspace.role === 'member') return <section className="panel"><h2>{t('gathering.hostsOnly')}</h2><p>{t('gathering.hostsOnlyText')}</p></section>;

  const urlBad = place === 'online' && url.trim() !== '' && !/^https:\/\/\S+$/i.test(url.trim());
  const valid = !(retreatOn && (!retreatEnd || !start || new Date(retreatEnd) <= new Date(start))) && title.trim() && start && !urlBad && (place === 'person' || url.trim()) && (!capacity || Number(capacity) >= 1) && (!priceCents || (priceCents >= 100 && priceCents <= 100000));
  const presets = datePresets(); const usual = editing ? null : usualSlot(history);
  const startDate = start ? new Date(start) : null;
  const dates = startDate && !editing ? expandRepeat(startDate, rule) : [];
  const weekly = !retreatOn && dates.length > 1;
  const retreatBad = retreatOn && (!retreatEnd || !startDate || new Date(retreatEnd) <= startDate);

  const payload = () => ({
    category, category_label: category === 'more' ? categoryLabel.trim() : '', title: title.trim(), cover_url: coverPath ?? '', cover_style: coverStyle, starts_at: new Date(start).toISOString(), duration_minutes: duration,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, location_name: place === 'person' ? locationName : '', address: place === 'person' ? address : '',
    meeting_note: place === 'person' ? note : '', online_url: place === 'online' ? url.trim() : '', capacity: capacity ? Number(capacity) : '',
    visibility, description_en: descEn.trim(), description_es: descEs.trim(), template_id: tpl?.id ?? '',
    ...(weekly ? { recurrence: rule.kind, occurrences: dates.map(d => d.toISOString()) } : {}),
    lat: place === 'person' && coords ? coords.lat : '', lng: place === 'person' && coords ? coords.lng : '',
  });

  const submit = async (publish: boolean) => {
    setTried(true); if (!valid) { toast.error(t('gathering.fixFields')); return; }
    if (priceCents && publish && !canSell) { toast.error(t('billing.payoutsRequired')); return; }
    setBusy(true);
    if (editing) {
      const { error } = await supabase.rpc('update_gathering', { _event: eventId!, _p: payload(), _whole_series: wholeSeries });
      if (!error && publish && source?.event.status === 'draft') { const r = await supabase.from('events').update({ status: 'published' }).eq('id', eventId!); if (r.error) { setBusy(false); toast.error(rpcError(t, r.error)); return; } }
      setBusy(false);
      if (error) { toast.error(rpcError(t, error)); return; }
      await savePrice(eventId!); await saveTeamReg(eventId!); if (!(await saveRetreat(eventId!))) return;
      await queryClient.invalidateQueries(); toast.success(t('gathering.saved'));
      void navigate({ to: '/event/$id', params: { id: eventId! } }); return;
    }
    const { data, error } = await supabase.rpc('create_gathering_at', { _team: teamId, _p: payload(), _publish: publish, _weekly: false }); if (!error) { trackEvent('gathering_created', { weekly }); if (publish) trackEvent('gathering_published'); if (templateId) trackEvent('template_launched'); }
    setBusy(false);
    if (error?.message?.includes('plan_limit_gatherings')) { setLimit('gatherings'); return; }
    if (error || !data) { toast.error(rpcError(t, error)); return; }
    if (weekly) { const { data: ev } = await supabase.from('events').select('series_id').eq('id', data).maybeSingle(); if (ev?.series_id) { const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('series_id', ev.series_id); if ((count ?? dates.length) < dates.length) toast.info(t('billing.freeSeriesLimit'), { duration: 8000 }); } }
    if (priceCents) await savePrice(data);
    if (teamReg.on) await saveTeamReg(data);
    if (retreatOn && !(await saveRetreat(data))) { void navigate({ to: '/gathering/$id/edit', params: { id: data } }); return; }
    await queryClient.invalidateQueries();
    if (publish) setDone({ id: data, visibility }); else { toast.success(t('gathering.draftSaved')); void navigate({ to: '/event/$id', params: { id: data } }); }
  };

  const onPhoto = async ({ file, square }: CropResult) => {
    setUploading(true);
    try {
      const path = await uploadMedia(userId, file, 'cover');
      // Square twin for social sharing lives next to the wide cover: <name>-square.webp
      if (square) await uploadMedia(userId, square, 'cover', path.replace(/\.webp$/, '-square.webp')).catch(() => null);
      setCoverPath(path);
    } catch (err) { if (err instanceof Error && err.message === 'storage_limit') setLimit('storage'); else toast.error(t('profile.saveError')); } finally { setUploading(false); }
  };
  const close = () => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/events' }));

  if (done) {
    const link = shareLink(done);
    const when = startDate!.toLocaleString(lang, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const invite = t('gathering.invite', { title: title.trim(), date: when, link });
    return <div className="gathering-screen"><div className="gathering-success">
      <GatheringCover path={coverPath} style={coverStyle} title={title} className="success-cover" />
      <span className="success-check"><Check /></span>
      <h1>{t('gathering.live')}</h1>
      <p className="success-title">{title}</p><p className="auth-subtitle">{when}{weekly ? ` · ${t(`gathering.repeats.${rule.kind}`)}` : ''}</p>
      <div className="success-share"><ShareKit title={title.trim()} startsAt={startDate!.toISOString()} place={place === 'person' ? (locationName || address) : t('teamSpace.online')} link={link} coverPath={coverPath} coverStyle={coverStyle} /></div>
      <Button className="onboarding-continue" onClick={() => navigate({ to: '/events', search: { tab: 'hosting' } })}>{t('gathering.done')}</Button>
    </div></div>;
  }

  return <div className="gathering-screen">
    <div className="gathering-form">
      <header className="gathering-form-head">
        <Button variant="ghost" size="icon" onClick={close} aria-label={t('common.close')}><X /></Button>
        <h1>{t(editing ? 'gathering.editTitle' : full ? 'gathering.newTitle' : 'gathering.quickTitle')}</h1>
        {tpl && <span className="chip">{t('gathering.fromTemplate', { title: tpl.title })}</span>}
      </header>

      {full && <section className="form-section">
        <GatheringCover path={coverPath} style={coverStyle} title={title || 'G'} className="form-cover" />
        <div className="cover-actions">
          <label className="file-button"><Camera /><span>{uploading ? t('onboarding.saving') : t(coverPath ? 'gathering.changePhoto' : 'gathering.addPhoto')}</span>
            <CropFileInput kind="cover" withSquare onCropped={r => void onPhoto(r)} onRejected={() => toast.error(t('gathering.photoTooBig'))} /></label>
          {coverPath && <Button variant="ghost" onClick={() => setCoverPath(null)}>{t('gathering.useDefault')}</Button>}
        </div>
        {!coverPath && <div className="style-picker" role="radiogroup" aria-label={t('gathering.coverStyle')}>{COVER_STYLES.map((bg, i) =>
          <button key={i} type="button" role="radio" aria-checked={coverStyle === i} aria-label={t('gathering.styleN', { n: i + 1 })} className={`style-swatch ${coverStyle === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} onClick={() => setCoverStyle(i)} />)}</div>}
      </section>}

      <section className="form-section">
        <label className="field-label" htmlFor="g-title">{t('gathering.title')}</label>
        <Input id="g-title" className="field-input" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('gathering.titlePlaceholder')} aria-invalid={tried && !title.trim()} />
        {tried && !title.trim() && <p className="field-error">{t('gathering.errors.invalid_title')}</p>}
      </section>

      <section className="form-section">
        <span className="field-label">{t('gathering.when')}</span>
        <div className="chip-row">{usual && (() => { const v = toLocalInput(usual); return <button type="button" className={`preset-chip is-usual ${start === v ? 'is-selected' : ''}`} aria-pressed={start === v} onClick={() => setStart(v)}>{t('gathering.presets.usual', { day: usual.toLocaleDateString(lang, { weekday: 'short' }), time: usual.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) })}</button>; })()}{presets.map(p => { const v = toLocalInput(p.date); return <button key={p.key} type="button" className={`preset-chip ${start === v ? 'is-selected' : ''}`} aria-pressed={start === v} onClick={() => setStart(v)}>{t(`gathering.presets.${p.key}`, { time: p.date.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) })}</button>; })}</div>
        <Input type="datetime-local" className="field-input" value={start} onChange={e => setStart(e.target.value)} aria-label={t('gathering.custom')} />
        {full && <>
        <span className="field-label">{t('gathering.duration')}</span>
        <div className="chip-row">{DURATIONS.map(d => <button key={d} type="button" className={`preset-chip ${!customDuration && duration === d ? 'is-selected' : ''}`} aria-pressed={!customDuration && duration === d} onClick={() => { setCustomDuration(false); setDuration(d); }}>{t(`gathering.durations.${d}`)}</button>)}
          <button type="button" className={`preset-chip ${customDuration ? 'is-selected' : ''}`} aria-pressed={customDuration} onClick={() => setCustomDuration(true)}>{t('gathering.customDuration')}</button></div>
        {customDuration && <div className="inline-field"><Input type="number" min={5} max={1440} className="field-input" value={duration} onChange={e => setDuration(Math.max(5, Math.min(1440, Number(e.target.value) || 5)))} aria-label={t('gathering.minutes')} /><span>{t('gathering.minutes')}</span></div>}
        {!editing && <PlaybookCard context="create" compact />}
        </>}
      </section>

      <section className="form-section">
        <span className="field-label">{t('gathering.place')}</span>
        <div className="segmented full" role="group" aria-label={t('gathering.place')}>{(['person', 'online'] as const).map(p => <Button key={p} variant="ghost" className={place === p ? 'selected' : ''} aria-pressed={place === p} onClick={() => setPlace(p)}>{p === 'person' ? <MapPin /> : <Globe2 />}{t(`map.${p}`)}</Button>)}</div>
        {place === 'person' ? <>
          <Input className="field-input" maxLength={160} value={locationName} onChange={e => setLocationName(e.target.value)} placeholder={t('gathering.locationName')} aria-label={t('gathering.locationName')} />
          <Input ref={addressRef} className="field-input" maxLength={300} value={address} onChange={e => { setAddress(e.target.value); setCoords(null); }} placeholder={t('gathering.address')} aria-label={t('gathering.address')} autoComplete="off" />
          {!mapsKey && <p className="not-connected">{t('gathering.addressNote')}</p>}
          <Input className="field-input" maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder={t('gathering.note')} aria-label={t('gathering.note')} />
        </> : <>
          <Input type="url" inputMode="url" className="field-input" maxLength={500} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" aria-label={t('gathering.link')} aria-invalid={urlBad || (tried && !url.trim())} />
          {(urlBad || (tried && !url.trim())) && <p className="field-error">{t('gathering.errors.invalid_url')}</p>}
        </>}
      </section>

      {full && <>
      <section className="form-section">
        <label className="field-label" htmlFor="g-category">{t('marketing.category')}</label>
        <select id="g-category" className="field-input" value={category} onChange={e => { if (isCategory(e.target.value)) setCategory(e.target.value); }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{t(c === 'more' ? 'marketing.other' : `landing.cat.${c}`)}</option>)}
        </select>
        {category === 'more' && <><label className="field-label" htmlFor="g-category-label">{t('marketing.customCategory')}</label><Input id="g-category-label" className="field-input" maxLength={60} value={categoryLabel} onChange={e => setCategoryLabel(e.target.value)} aria-describedby="g-category-hint"/><small id="g-category-hint" className="field-hint">{t('marketing.customCategoryHint')}</small></>}
      </section>

      <section className="form-section two-col">
        <div><label className="field-label" htmlFor="g-cap">{t('gathering.capacity')}</label>
          <Input id="g-cap" type="number" min={1} inputMode="numeric" className="field-input" value={capacity} onChange={e => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder={t('gathering.noLimit')} /></div>
        <div><label className="field-label" htmlFor="g-price">{t('billing.price')}</label>
          <Input id="g-price" type="text" inputMode="decimal" className="field-input" disabled={!canSell && !price} value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} placeholder="$0" />
          <small className="field-hint">{canSell ? t('billing.priceHint') : t('billing.priceNeedsPayouts')}</small>
          <PriceGuidance category={category} />
          {!!priceCents && <label className="settings-row is-static gathering-cover-fee"><span className="settings-label">{t('billing.coverFee')}<small className="field-hint">{coverFee ? t('billing.coverFeeOn') : t('billing.coverFeeOff')}</small></span><Switch aria-label={t('billing.coverFee')} checked={coverFee} onCheckedChange={setCoverFee} /></label>}
          {!!priceCents && <><label className="field-label" htmlFor="g-cseats">{t('community.seatsField')}</label><Input id="g-cseats" inputMode="numeric" className="field-input" value={communitySeats} onChange={e => setCommunitySeats(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder={t('community.seatsNone')} /><small className="field-hint">{t('community.seatsHint')}</small></>}</div>
        <div><span className="field-label">{t('gathering.visibility')}</span>
          <div className="segmented full" role="group" aria-label={t('gathering.visibility')}>{(['public', 'invite', 'team'] as const).map(v => <Button key={v} variant="ghost" className={visibility === v ? 'selected' : ''} aria-pressed={visibility === v} onClick={() => setVisibility(v)}>{t(`gathering.vis.${v}`)}</Button>)}</div></div>
      </section>

      <section className="form-section">
        <label className="guest-consent"><input type="checkbox" checked={teamReg.on} onChange={e => setTeamReg(r => ({ ...r, on: e.target.checked }))} /><span><strong>{t('teamRsvp.hostToggle')}</strong><br /><small className="field-hint">{t('teamRsvp.hostHint')}</small></span></label>
        {teamReg.on && <>
          <div className="two-col">
            <div><label className="field-label" htmlFor="g-tmin">{t('teamRsvp.minSize')}</label><Input id="g-tmin" type="number" min={2} max={20} className="field-input" value={teamReg.min} onChange={e => { const v = Math.max(2, Math.min(20, Number(e.target.value) || 2)); setTeamReg(r => ({ ...r, min: v, max: Math.max(v, r.max) })); }} /></div>
            <div><label className="field-label" htmlFor="g-tmax">{t('teamRsvp.maxSize')}</label><Input id="g-tmax" type="number" min={2} max={20} className="field-input" value={teamReg.max} onChange={e => { const v = Math.max(2, Math.min(20, Number(e.target.value) || 2)); setTeamReg(r => ({ ...r, max: v, min: Math.min(v, r.min) })); }} /></div>
          </div>
          {priceCents ? <div className="segmented full" role="group" aria-label={t('teamRsvp.priceMode')}>{(['person', 'team'] as const).map(m => <Button key={m} variant="ghost" className={teamReg.mode === m ? 'selected' : ''} aria-pressed={teamReg.mode === m} onClick={() => setTeamReg(r => ({ ...r, mode: m }))}>{t(`teamRsvp.mode.${m}`)}</Button>)}</div> : null}
          <p className="field-hint">{t('teamRsvp.capacityNote')}</p>
        </>}
      </section>

      <section className="form-section">
        <div className="desc-head"><div className="segmented" role="tablist" aria-label={t('gathering.description')}>{(['en', 'es'] as const).map(l => <Button key={l} role="tab" variant="ghost" aria-selected={descTab === l} className={descTab === l ? 'selected' : ''} onClick={() => setDescTab(l)}>{t(l === 'en' ? 'me.english' : 'me.spanish')}</Button>)}</div>
          <Button variant="ghost" size="sm" disabled={tr.busy} onClick={async () => { await tr.run(descEn, descEs, setDescEn, setDescEs); setDescTab(descEn.trim() ? 'es' : 'en'); }}><Languages />{tr.busy ? t('assistant.translating') : t('gathering.translate')}</Button></div>
        <Textarea rows={4} maxLength={4000} className="field-textarea" value={descTab === 'en' ? descEn : descEs} onChange={e => (descTab === 'en' ? setDescEn : setDescEs)(e.target.value)} aria-label={t('gathering.description')} placeholder={t('gathering.descPlaceholder')} />
        <ClaimGuard text={descTab === 'en' ? descEn : descEs} lang={descTab} onUse={v => (descTab === 'en' ? setDescEn : setDescEs)(v)} />
        {tr.preview && <p className="not-connected">{t('assistant.previewTranslateNote')}</p>}
      </section>

      <section className="form-section">
        <label className="guest-consent"><input type="checkbox" checked={retreatOn} onChange={e => { setRetreatOn(e.target.checked); if (e.target.checked && !retreatEnd && startDate) { const d = new Date(startDate); d.setDate(d.getDate() + 2); d.setHours(12, 0, 0, 0); setRetreatEnd(toLocalInput(d)); } }} /><span><strong>{t('retreat.toggle')}</strong><br /><small className="field-hint">{t('retreat.toggleHint')}</small></span></label>
        {retreatOn && <RetreatEditor value={retreat} onChange={setRetreat} end={retreatEnd} setEnd={setRetreatEnd} priceCents={priceCents} onUpload={uploadGallery} uploading={galleryBusy} />}
        {retreatBad && tried && <p className="field-error">{t('retreat.errors.invalid_retreat_dates')}</p>}
      </section>

      {retreatOn ? null : !editing ? <section className="form-section">
        <label className="field-label" htmlFor="g-repeat">{t('gathering.repeat')}</label>
        <select id="g-repeat" className="field-input" value={rule.kind} onChange={e => setRule(r => ({ ...r, kind: e.target.value as RepeatKind }))}>
          {REPEATS.map(k => <option key={k} value={k}>{t(`gathering.repeats.${k}`)}</option>)}
        </select>
        {rule.kind === 'monthly' && startDate && <div className="segmented full" role="group" aria-label={t('gathering.repeats.monthly')}>{(['date', 'nth', 'last'] as const).map(m => <Button key={m} variant="ghost" className={rule.monthly === m ? 'selected' : ''} aria-pressed={rule.monthly === m} onClick={() => setRule(r => ({ ...r, monthly: m }))}>{t(`gathering.monthly.${m}`, { date: startDate.getDate(), nth: t(`gathering.nth.${Math.min(4, Math.floor((startDate.getDate() - 1) / 7))}`), day: startDate.toLocaleDateString(lang, { weekday: 'long' }) })}</Button>)}</div>}
        {rule.kind === 'custom' && <div className="chip-row" role="group" aria-label={t('gathering.pickDays')}>{[0, 1, 2, 3, 4, 5, 6].map(d => { const on = rule.days.includes(d); return <button key={d} type="button" className={`preset-chip ${on ? 'is-selected' : ''}`} aria-pressed={on} onClick={() => setRule(r => ({ ...r, days: on ? r.days.filter(x => x !== d) : [...r.days, d] }))}>{new Date(2024, 0, 7 + d).toLocaleDateString(lang, { weekday: 'short' })}</button>; })}</div>}
        {rule.kind !== 'none' && <>
          <div className="segmented full" role="group" aria-label={t('gathering.ends')}>{(['count', 'until'] as const).map(m => <Button key={m} variant="ghost" className={rule.endMode === m ? 'selected' : ''} aria-pressed={rule.endMode === m} onClick={() => setRule(r => ({ ...r, endMode: m }))}>{t(`gathering.end.${m}`)}</Button>)}</div>
          {rule.endMode === 'count'
            ? <div className="inline-field"><Input type="number" min={2} max={52} className="field-input" value={rule.count} onChange={e => setRule(r => ({ ...r, count: Math.max(2, Math.min(52, Number(e.target.value) || 2)) }))} aria-label={t('gathering.end.times')} /><span>{t('gathering.end.times')}</span></div>
            : <Input type="date" className="field-input" value={rule.until} onChange={e => setRule(r => ({ ...r, until: e.target.value }))} aria-label={t('gathering.end.until')} />}
          <p className="auth-subtitle">{t('gathering.repeatSummary', { count: dates.length, last: dates[dates.length - 1]!.toLocaleDateString(lang, { month: 'short', day: 'numeric' }) })}</p>
        </>}
      </section> : source?.event.series_id ? <section className="form-section">
        <span className="field-label">{t('gathering.applyTo')}</span>
        <div className="segmented full" role="group" aria-label={t('gathering.applyTo')}>{([false, true] as const).map(w => <Button key={String(w)} variant="ghost" className={wholeSeries === w ? 'selected' : ''} aria-pressed={wholeSeries === w} onClick={() => setWholeSeries(w)}>{t(w ? 'gathering.thisAndLater' : 'gathering.thisDate')}</Button>)}</div>
      </section> : null}
      </>}
      {!full && <Button variant="ghost" className="quick-more" onClick={() => setFull(true)}>{t('gathering.moreOptions')}<ChevronRight /></Button>}
      {tpl && <p className="auth-subtitle">{t('gathering.checklistNote', { count: checklistOf(templates.find(x => x.id === tpl.id) ?? { checklist: [] }).length })}</p>}
    </div>
    <div className="sticky-actions">
      {full && (!editing || source?.event.status === 'draft') && <Button variant="secondary" disabled={busy} onClick={() => submit(false)}>{t('gathering.saveDraft')}</Button>}
      <Button disabled={busy} onClick={() => submit(!editing || source?.event.status === 'draft')}>{busy ? t('onboarding.saving') : t(editing && source?.event.status !== 'draft' ? 'gathering.saveChanges' : 'gathering.publish')}</Button>
    </div>
    {limit && <UpgradeSheet open onOpenChange={o => { if (!o) setLimit(null); }} reason={limit} />}
  </div>;
}
