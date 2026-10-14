import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GwFeatureTile, GwIcon, type GwIconName } from '@/components/gw-icon';
import { CropFileInput } from '@/components/image-crop';
import { CopyButton } from '@/components/copy-button';
import { ShareKit } from '@/components/share-kit';
import { GatheringCover } from '@/components/gathering-cover';
import { ListSkeleton } from '@/components/launch-states';
import { useGatherwell } from '@/components/gatherwell-shell';
import { usePaymentGate } from '@/components/plan-page';
import { uploadMedia, mediaUrl, initialsOf } from '@/lib/account';
import { formatMoney, planSettingsQuery } from '@/lib/billing';
import { startConnectOnboarding, startPlanCheckout } from '@/lib/billing.functions';
import { trackEvent } from '@/lib/analytics';

export type StartKind = 'free' | 'paid' | 'circle';
export type StartSearch = { step?: 1 | 2 | 3 | 4 | undefined; kind?: StartKind | undefined; id?: string | undefined };

const STARTERS: { kind: StartKind; icon: GwIconName; dow: number; hour: number; price: number }[] = [
  { kind: 'free', icon: 'CalendarDays', dow: 6, hour: 8, price: 0 },
  { kind: 'paid', icon: 'CalendarCheck', dow: 4, hour: 19, price: 1500 },
  { kind: 'circle', icon: 'UsersRound', dow: -1, hour: 0, price: 2000 },
];

/** Next given weekday at hour, at least one day away, as yyyy-mm-dd / hh:mm in local time. */
function nextSlot(dow: number, hour: number) {
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(hour)}:00` };
}

function Progress({ step }: { step: number }) {
  const { t } = useTranslation();
  const labels = [t('quickStart.s1'), t('quickStart.s2'), t('quickStart.s3')];
  return <div className="qs-progress">
    <div className="qs-progress-top"><span>{t('quickStart.stepOf', { n: Math.min(step, 3) })}</span><span className="qs-time"><GwIcon name="Clock" size={16} />{t('quickStart.about')}</span></div>
    <span className="plan-meter-bar qs-bar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(step, 3)}><span style={{ width: `${Math.min(step, 3) / 3 * 100}%` }} /></span>
    <ol className="qs-steps">{labels.map((l, i) => <li key={l} className={i + 1 < step ? 'is-done' : i + 1 === step ? 'is-current' : ''}>{i + 1 < step ? <GwIcon name="Check" size={16} /> : <span>{i + 1}</span>}{l}</li>)}</ol>
  </div>;
}

export function QuickStartPage({ search }: { search: StartSearch }) {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const navigate = useNavigate({ from: '/start' });
  const step = search.step ?? 1;
  const go = (s: StartSearch) => void navigate({ search: s });
  const profile = useQuery({ queryKey: ['qs-profile', userId], queryFn: async () => { const { data } = await supabase.from('profiles').select('full_name, avatar_url, bio, city, language, host_languages, active_team_id, slug').eq('id', userId).maybeSingle(); return data; } });
  if (profile.isLoading || !profile.data) return <ListSkeleton />;
  return <div className="qs">
    <div className="page-heading"><div><span className="eyebrow">{t('quickStart.eyebrow')}</span><h1>{step === 4 ? t('quickStart.liveTitle') : t('quickStart.title')}</h1></div></div>
    {step < 4 && <Progress step={step} />}
    {step === 1 && <CreateStep profile={profile.data} onDone={(kind, id) => go({ step: 2, kind, id })} />}
    {step === 2 && search.id && search.kind && <ShareStep kind={search.kind} id={search.id} onNext={() => go({ ...search, step: 3 })} onBack={() => go({ ...search, step: 1 })} />}
    {step === 3 && <PaidStep kind={search.kind} onNext={() => go({ ...search, step: 4 })} onBack={() => go({ ...search, step: 2 })} />}
    {step === 4 && search.id && search.kind && <LiveStep kind={search.kind} id={search.id} name={profile.data.full_name} />}
    {step > 1 && (!search.id || !search.kind) && step !== 3 && <Button onClick={() => go({ step: 1 })}>{t('quickStart.restart')}</Button>}
  </div>;
}

type Prof = { full_name: string | null; avatar_url: string | null; bio: string | null; city: string | null; language: string; host_languages: string[]; active_team_id: string | null; slug: string | null };

function CreateStep({ profile, onDone }: { profile: Prof; onDone: (k: StartKind, id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const [name, setName] = useState(profile.full_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [langs, setLangs] = useState<string[]>(profile.host_languages.length ? profile.host_languages : [lang]);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<StartKind | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(''); const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const avatarUrl = useQuery({ queryKey: ['media-url', avatar], queryFn: () => mediaUrl(avatar), enabled: !!avatar && !preview, staleTime: 50 * 60 * 1000 });

  const pick = (k: StartKind) => {
    const s = STARTERS.find(x => x.kind === k)!;
    setKind(k); setTitle(t(`quickStart.starter_${k}`));
    if (s.dow >= 0) { const n = nextSlot(s.dow, s.hour); setDate(n.date); setTime(n.time); }
    setPrice(s.price ? String(s.price / 100) : '');
  };
  const toggleLang = (l: string) => setLangs(x => x.includes(l) ? (x.length > 1 ? x.filter(y => y !== l) : x) : [...x, l]);

  const submit = async () => {
    if (name.trim().length < 2) { toast.error(t('quickStart.needName')); return; }
    if (!kind || !title.trim()) { toast.error(t('quickStart.needStarter')); return; }
    if (kind !== 'circle' && (!date || !time)) { toast.error(t('quickStart.needDate')); return; }
    if (kind !== 'free' && !(Number(price) >= 1)) { toast.error(t('quickStart.needPrice')); return; }
    let team = profile.active_team_id;
    setBusy(true);
    try {
      if (!team) {
        // Every host gets their own space by default: create it from their name.
        const { data: made, error: te } = await supabase.rpc('create_team', { _name: name.trim() });
        if (te || !made?.[0]) throw te ?? new Error('create_team');
        team = made[0].id;
        await supabase.from('profiles').update({ active_team_id: team }).eq('id', userId);
      }
      const { error: pe } = await supabase.from('profiles').update({ full_name: name.trim(), bio: bio.trim().slice(0, 160) || null, city: city.trim() || null, host_languages: langs, language: langs.includes(lang) ? lang : (langs[0] as 'en' | 'es'), avatar_url: avatar }).eq('id', userId);
      if (pe) throw pe;
      const cents = Math.round(Number(price) * 100);
      let id: string;
      if (kind === 'circle') {
        const { data, error } = await supabase.from('offers').insert({ host_id: userId, team_id: team, kind: 'membership', title_en: lang === 'en' ? title.trim() : t('quickStart.starter_circle', { lng: 'en' }), title_es: lang === 'es' ? title.trim() : t('quickStart.starter_circle', { lng: 'es' }),
          description_en: t('quickStart.circleDesc', { lng: 'en' }), description_es: t('quickStart.circleDesc', { lng: 'es' }), includes_en: [], includes_es: [], price_cents: cents, cover_style: 2, drip_days: 7, status: 'published' }).select('id').single();
        if (error) throw error; id = data.id;
      } else {
        const start = new Date(`${date}T${time}`);
        const { data, error } = await supabase.rpc('create_gathering_at', { _team: team, _publish: kind === 'free', _weekly: false, _p: {
          title: title.trim(), cover_url: '', cover_style: kind === 'free' ? 1 : 3, starts_at: start.toISOString(), duration_minutes: 60, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location_name: place.trim(), address: '', meeting_note: '', online_url: '', capacity: '20', visibility: 'public', description_en: t(`quickStart.desc_${kind}`, { lng: 'en' }), description_es: t(`quickStart.desc_${kind}`, { lng: 'es' }), template_id: '', lat: '', lng: '' } });
        if (error || !data) throw error ?? new Error('create');
        id = data as string;
        trackEvent('gathering_created', { weekly: false });
        if (kind === 'paid') {
          // Paid tickets need payouts; until then the gathering waits as a draft with its price noted for the coach.
          const { error: ue } = await supabase.from('events').update({ price_cents: cents }).eq('id', id);
          if (!ue) { await supabase.from('events').update({ status: 'published' }).eq('id', id); trackEvent('gathering_published'); }
        } else trackEvent('gathering_published');
      }
      await qc.invalidateQueries();
      onDone(kind, id);
    } catch { toast.error(t('quickStart.error')); }
    setBusy(false);
  };

  const shown = preview ?? avatarUrl.data ?? null;
  return <div className="qs-body">
    <section className="panel qs-section"><h2>{t('quickStart.aboutYou')}</h2>
      <div className="qs-avatar-row">
        {shown ? <img src={shown} alt="" className="qs-avatar" /> : <span className="qs-avatar is-initials" aria-hidden>{initialsOf(name)}</span>}
        <label className="btn-like"><GwIcon name="ImagePlus" />{t('quickStart.photo')}<CropFileInput kind="avatar" onCropped={async r => { setPreview(r.previewUrl); try { setAvatar(await uploadMedia(userId, r.file, 'avatar')); } catch { toast.error(t('error.message')); } }} /></label>
      </div>
      <div className="field"><Label htmlFor="qs-name">{t('quickStart.name')}</Label><Input id="qs-name" autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field"><Label htmlFor="qs-bio">{t('quickStart.bio')}</Label><Textarea id="qs-bio" maxLength={160} rows={2} value={bio} onChange={e => setBio(e.target.value)} placeholder={t('quickStart.bioPlaceholder')} /><p className="field-hint">{t('quickStart.bioHint', { n: 160 - bio.length })}</p></div>
      <fieldset className="field qs-langs"><legend className="field-label">{t('quickStart.languages')}</legend>
        {(['en', 'es'] as const).map(l => <button key={l} type="button" aria-pressed={langs.includes(l)} className={`chip qs-chip${langs.includes(l) ? ' selected' : ''}`} onClick={() => toggleLang(l)}>{langs.includes(l) && <GwIcon name="Check" size={16} />}{t(`quickStart.lang_${l}`)}</button>)}</fieldset>
      <div className="field"><Label htmlFor="qs-city">{t('quickStart.city')}</Label><Input id="qs-city" autoComplete="address-level2" maxLength={80} value={city} onChange={e => setCity(e.target.value)} /></div>
    </section>
    <section className="panel qs-section"><h2>{t('quickStart.pickStarter')}</h2>
      <div className="qs-starters" role="radiogroup" aria-label={t('quickStart.pickStarter')}>{STARTERS.map(s => <button key={s.kind} type="button" role="radio" aria-checked={kind === s.kind} className={`loc-mode${kind === s.kind ? ' selected' : ''}`} onClick={() => pick(s.kind)}>
        <GwFeatureTile name={s.icon} size={24} /><span><strong>{t(`quickStart.kind_${s.kind}`)}</strong><small>{t(`quickStart.starter_${s.kind}`)} · {t(`quickStart.kindHint_${s.kind}`)}</small></span></button>)}</div>
      {kind && <div className="qs-starter-fields">
        <div className="field"><Label htmlFor="qs-title">{t('quickStart.starterTitle')}</Label><Input id="qs-title" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></div>
        {kind !== 'circle' && <><div className="loc-two"><div className="field"><Label htmlFor="qs-date">{t('quickStart.date')}</Label><Input id="qs-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><Label htmlFor="qs-time">{t('quickStart.time')}</Label><Input id="qs-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div></div>
          <div className="field"><Label htmlFor="qs-place">{t('quickStart.place')}</Label><Input id="qs-place" maxLength={160} value={place} onChange={e => setPlace(e.target.value)} placeholder={t('quickStart.placePlaceholder')} /></div></>}
        {kind !== 'free' && <div className="field"><Label htmlFor="qs-price">{kind === 'circle' ? t('quickStart.priceMonthly') : t('quickStart.price')}</Label><Input id="qs-price" type="number" min={1} step="1" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /><p className="field-hint">{t('quickStart.priceHint')}</p></div>}
      </div>}
    </section>
    <p className="field-hint">{t('quickStart.later')}</p>
    <Button className="onboarding-continue" disabled={busy} onClick={() => void submit()}>{busy ? t('onboarding.saving') : t('quickStart.publish')}</Button>
  </div>;
}

function useStarter(kind: StartKind, id: string) {
  return useQuery({ queryKey: ['qs-starter', kind, id], queryFn: async () => {
    if (kind === 'circle') { const { data } = await supabase.from('offers').select('id, title_en, title_es, price_cents, cover_style').eq('id', id).maybeSingle(); return data ? { title: '', title_en: data.title_en, title_es: data.title_es, starts_at: null as string | null, timezone: null as string | null, place: '', price: data.price_cents, cover_style: data.cover_style as number | null, cover_url: null as string | null, draft: false } : null; }
    const { data } = await supabase.from('events').select('id, title, starts_at, timezone, location_name, price_cents, cover_style, cover_url, status').eq('id', id).maybeSingle();
    return data ? { title: data.title, title_en: '', title_es: '', starts_at: data.starts_at, timezone: data.timezone, place: data.location_name ?? '', price: data.price_cents, cover_style: data.cover_style, cover_url: data.cover_url, draft: data.status !== 'published' } : null;
  } });
}
const starterLink = (kind: StartKind, id: string) => `${window.location.origin}${kind === 'circle' ? '/offer/' : '/e/'}${id}`;

function ShareStep({ kind, id, onNext, onBack }: { kind: StartKind; id: string; onNext: () => void; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const s = useStarter(kind, id);
  if (!s.data) return <ListSkeleton />;
  const d = s.data;
  const title = kind === 'circle' ? (lang === 'es' ? d.title_es : d.title_en) : d.title;
  const link = starterLink(kind, id);
  const when = d.starts_at ? new Date(d.starts_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(d.timezone ? { timeZone: d.timezone } : {}) }) : '';
  const message = kind === 'circle' ? t('quickStart.waCircle', { title, link }) : t('quickStart.waGathering', { title, when, link });
  return <div className="qs-body">
    {d.draft && <p className="qs-note"><GwIcon name="AlertCircle" size={18} />{t('quickStart.draftNote')}</p>}
    <section className="panel qs-section"><h2>{t('quickStart.yourLink')}</h2>
      <div className="qs-link"><code>{link}</code><CopyButton text={link} /></div>
      <div className="qs-qr"><QRCodeSVG value={link} size={168} marginSize={2} title={t('quickStart.qrAlt', { title })} /><p className="field-hint">{t('quickStart.qrHint')}</p></div>
      <CopyButton text={message} label={t('quickStart.copyWa')} />
    </section>
    {kind !== 'circle' && d.starts_at ? <section className="panel qs-section"><h2>{t('quickStart.images')}</h2>
      <ShareKit title={title} startsAt={d.starts_at} timezone={d.timezone} place={d.place} link={link} coverPath={d.cover_url} coverStyle={d.cover_style} /></section>
      : <p className="field-hint">{t('quickStart.circleImages')}</p>}
    <div className="qs-nav"><Button variant="secondary" onClick={onBack}>{t('quickStart.back')}</Button><Button onClick={onNext}>{t('quickStart.next')}</Button></div>
  </div>;
}

function PaidStep({ kind, onNext, onBack }: { kind?: StartKind | undefined; onNext: () => void; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const gate = usePaymentGate();
  const connect = useServerFn(startConnectOnboarding);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return <div className="qs-body">
    <section className="panel qs-section"><h2>{t('quickStart.payouts')}</h2>
      <p className="auth-subtitle">{kind === 'free' ? t('quickStart.payoutsFree') : t('quickStart.payoutsText')}</p>
      {!gate.connected && <p className="qs-note"><GwIcon name="AlertCircle" size={18} />{t('quickStart.notConnected')}</p>}
      <Button variant="secondary" disabled={gate.busy} onClick={() => void gate.run(() => connect({ data: { origin } }))}><GwIcon name="CreditCard" />{t('quickStart.connectPayouts')}</Button>
    </section>
    <p className="qs-note"><GwIcon name="Sparkles" size={18} />{t('quickStart.onFree')}</p>
    <div className="qs-nav"><Button variant="secondary" onClick={onBack}>{t('quickStart.back')}</Button><Button onClick={onNext}>{t('quickStart.finish')}</Button></div>
    {gate.sheet}
  </div>;
}

function LiveStep({ kind, id, name }: { kind: StartKind; id: string; name: string | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const s = useStarter(kind, id);
  // Going live starts the first 30 days without limits (set once).
  useEffect(() => { void supabase.rpc('start_hosting_window'); }, []);
  const d = s.data;
  const title = d ? (kind === 'circle' ? (lang === 'es' ? d.title_es : d.title_en) : d.title) : '';
  return <div className="qs-body">
    <section className="panel qs-live" aria-live="polite">
      <GwFeatureTile name="CheckCircle2" size={32} />
      <p className="auth-subtitle">{d?.draft ? t('quickStart.liveDraft', { name: name ?? '' }) : t('quickStart.liveText', { name: name ?? '' })}</p>
    </section>
    {d && <section className="panel qs-preview"><span className="eyebrow">{t('quickStart.preview')}</span>
      <GatheringCover style={d.cover_style} title={title} className="qs-preview-cover" />
      <strong className="qs-preview-title">{title}</strong>
      <small>{[d.starts_at ? new Date(d.starts_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : t('quickStart.monthly'), d.place, d.price ? formatMoney(d.price, lang) : t('quickStart.freeLabel')].filter(Boolean).join(' · ')}</small>
      <Button asChild variant="secondary"><a href={starterLink(kind, id)} target="_blank" rel="noopener noreferrer"><GwIcon name="ExternalLink" />{t('quickStart.openPage')}</a></Button>
    </section>}
    <p className="field-hint">{t('quickStart.laterItems')}</p>
    <Button asChild className="onboarding-continue"><Link to="/home">{t('quickStart.toHome')}</Link></Button>
  </div>;
}
