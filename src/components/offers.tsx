import { RefundLine, RefundSelect } from '@/components/refund-line';
import { asRefundPolicy, type RefundPolicy } from '@/lib/refunds';
import { FoundingSeal } from '@/components/founding';
import { LangFields, LangPair } from '@/components/lang-fields';
import { VerifiedMark, useIsVerified } from '@/components/coach-trust';
import { PromoField } from '@/components/promo-field';
import { promoDiscount, type Promo } from '@/lib/promo';
import { EmptyState } from '@/components/launch-states';
import { CropFileInput } from '@/components/image-crop';
import { BrandImage } from '@/components/brand-image';
import { DocumentViewer } from '@/components/document-viewer';
import { useEffect, useState } from 'react';
import { confirmAction } from '@/components/confirm-dialog';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Check, Download, Lock, ChevronRight, Pencil, Upload, FileText, CalendarDays } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { workspaceQuery, mediaUrl, mediaRendition, uploadMedia } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { formatMoney, paymentsStatusQuery } from '@/lib/billing';
import {
  deleteOffer, getOfferLink, isLive, joinFreeOffer, linkableOffersQuery, myOffersQuery, offerIncludes, offerQuery, offerText, offerTitle,
  purchasesQuery, saveOffer, setOfferLink, teamOffersQuery, uploadOfferFile, type Offer, type OfferKind,
  foundingStatusQuery,
} from '@/lib/offers';
import { cancelOfferMembership, offerDownloadLink, pauseOfferMembership, startOfferCheckout } from '@/lib/offers.functions';
import { CommunityRequestsPanel, CommunitySeatCard } from '@/components/community-seats';
import { BundlePanel, BundleReader, CurriculumPanel, OfferDetailsEditor, OfferHostActions, PublicOfferLink, ReadinessPanel } from '@/components/content-studio';
import { QuizPanel, LearnerQuizList, CourseProgressPanel, CertificateSettings, LearnerProgressPanel } from '@/components/quiz';
import { canAccessOfferQuery } from '@/lib/content';

const KINDS: OfferKind[] = ['membership', 'course', 'download'];
const dateFmt = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function OfferCover({ offer, wide, preview }: { offer: Pick<Offer, 'cover_style' | 'cover_url' | 'kind' | 'title_en' | 'title_es'>; wide?: boolean; preview?: string | null }) {
  const { t, i18n } = useTranslation();
  const { data: url } = useQuery({ queryKey: ['media-rendition', offer.cover_url], queryFn: () => mediaRendition(offer.cover_url), enabled: !!offer.cover_url && !preview, staleTime: 50 * 60 * 1000 });
  return <div className={`offer-cover ${wide ? 'is-wide' : ''}`} style={{ backgroundImage: COVER_STYLES[offer.cover_style % COVER_STYLES.length] }}>
    {(preview || url) && <BrandImage src={preview ?? url} alt={offerTitle(offer, i18n.resolvedLanguage)} className="offer-cover-photo" priority={wide} sizes={wide ? '(min-width: 768px) 720px, 100vw' : '(min-width: 640px) 400px, 100vw'} />}
    <span className="chip offer-kind">{t(`offers.kind.${offer.kind}`)}</span></div>;
}

function priceLabel(t: import('i18next').TFunction, o: Pick<Offer, 'price_cents' | 'kind'>, lang: string) {
  if (!o.price_cents) return t('offers.free');
  const m = formatMoney(o.price_cents, lang);
  return o.kind === 'download' ? m : t('offers.perMonth', { price: m });
}

/* ---------- Host: manage offers ---------- */
export function OffersManagePage({ newKind, mode }: { newKind?: 'course' | 'download' | undefined; mode?: 'bundle' | undefined } = {}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const { data: ws } = useQuery(workspaceQuery(userId));
  const q = useQuery(myOffersQuery(userId));
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);
  const canHost = ws && ws.role !== 'member';
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (newKind && canHost && !opened) { setOpened(true); setEditing({ kind: newKind, price_cents: 0, cover_style: 0, drip_days: 7, includes_en: [], includes_es: [], status: 'draft' }); } }, [newKind, canHost, opened]);

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('offers.eyebrow')}</span><h1>{t('offers.title')}</h1><p className="auth-subtitle">{t('offers.subtitle')}</p></div>
      {canHost && <Button onClick={() => setEditing({ kind: 'membership', price_cents: 0, cover_style: 0, drip_days: 7, includes_en: [], includes_es: [], status: 'draft' })}><Plus />{t('offers.new')}</Button>}</div>
    {!canHost && <section className="panel"><p className="auth-subtitle">{t('offers.hostsOnly')}</p></section>}
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data.length ? (canHost ? <section className="panel empty-state"><FileText /><p>{t('offers.empty')}</p></section> : null) :
      <ul className="offer-list">{q.data.map(o => <li key={o.id} className="panel offer-row">
        <OfferCover offer={o} />
        <div className="offer-row-main"><strong>{offerTitle(o, lang) || t('offers.untitled')}</strong>
          <small>{priceLabel(t, o, lang)} · {t(`offers.status.${o.status}`)}</small>
          <small>{t(o.kind === 'download' ? 'offers.buyers' : 'offers.members', { count: o.active })}</small></div>
        <div className="offer-row-actions">
          <Button asChild variant="ghost" size="icon" aria-label={t('offers.view')}><Link to="/offer/$id" params={{ id: o.id }}><ChevronRight /></Link></Button>
          <Button variant="secondary" size="icon" aria-label={t('offers.edit')} onClick={() => setEditing(o)}><Pencil /></Button>
        </div>
      </li>)}</ul>}
    {ws && <OfferEditor offer={editing} teamId={ws.teamId} onClose={() => setEditing(null)} bundleMode={mode === 'bundle' && editing?.kind === 'download' && !editing?.id} />}
  </>;
}

function OfferEditor({ offer, teamId, onClose, bundleMode }: { offer: Partial<Offer> | null; teamId: string; onClose: () => void; bundleMode?: boolean | undefined }) {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const blank = { kind: 'membership' as OfferKind, title_en: '', title_es: '', description_en: '', description_es: '', inc_en: '', inc_es: '', price: '', refund: '24h' as RefundPolicy, cover_style: 0, cover_url: null as string | null, drip_days: 7, file_path: null as string | null, publish: false, f_seats: '', f_price: '', c_seats: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  useEffect(() => {
    if (!offer) return;
    setCoverFile(null); setCoverPreview(null);
    setF({ kind: offer.kind ?? 'membership', title_en: offer.title_en ?? '', title_es: offer.title_es ?? '', description_en: offer.description_en ?? '', description_es: offer.description_es ?? '',
      inc_en: (offer.includes_en ?? []).join('\n'), inc_es: (offer.includes_es ?? []).join('\n'), price: offer.price_cents ? String(offer.price_cents / 100) : '', refund: asRefundPolicy((offer as { refund_policy?: string }).refund_policy),
      cover_style: offer.cover_style ?? 0, cover_url: offer.cover_url ?? null, drip_days: offer.drip_days ?? 7, file_path: offer.file_path ?? null, publish: offer.status === 'published', f_seats: offer.founding_seats ? String(offer.founding_seats) : '', f_price: offer.founding_seats ? String((offer.founding_price_cents ?? 0) / 100) : '', c_seats: offer.community_seats ? String(offer.community_seats) : '' });
  }, [offer]);
  const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8);
  const priceNum = Number(f.price || 0);
  const valid = !!(f.title_en.trim() || f.title_es.trim()) && Number.isFinite(priceNum) && priceNum >= 0 && priceNum <= 1000 && (f.kind !== 'download' || !f.publish || !!f.file_path);
  const save = async () => {
    setBusy(true);
    try {
    const cover_url = coverFile ? await uploadMedia(userId, coverFile, 'cover') : f.cover_url;
    const row = { kind: f.kind, title_en: f.title_en.trim(), title_es: f.title_es.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null,
      includes_en: lines(f.inc_en), includes_es: lines(f.inc_es), price_cents: Math.round(priceNum * 100), refund_policy: f.refund, cover_style: f.cover_style, cover_url, drip_days: f.drip_days, file_path: f.file_path,
      ...(f.kind === 'membership' && Number(f.f_seats) > 0 ? { founding_seats: Math.min(500, Math.round(Number(f.f_seats))), founding_price_cents: Math.round(Number(f.f_price || 0) * 100) } : { founding_seats: null, founding_price_cents: null }),
      community_seats: Number(f.c_seats) > 0 ? Math.min(100, Math.round(Number(f.c_seats))) : null,
      status: f.publish ? 'published' as const : (offer?.status === 'published' ? 'archived' as const : 'draft' as const) };
    const res = await saveOffer(offer?.id ? row : { ...row, team_id: teamId, host_id: userId }, offer?.id);
    setBusy(false);
    if (res.error) { toast.error(t(String(res.error.message).includes('payouts_required') ? 'billing.payoutsRequired' : 'offers.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['offers'] });
    onClose();
    } catch { toast.error(t('offers.uploadError')); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!offer?.id || !(await confirmAction({ title: t('offers.confirmDelete'), destructive: true }))) return;
    const { data: tr } = await db.from('tracks').select('id').eq('offer_id', offer.id);
    const files = await learnPathsForTracks((tr ?? []).map((x: { id: string }) => x.id));
    const res = await deleteOffer(offer.id);
    if (res.error) { toast.error(t('offers.deleteError')); return; }
    void removeUnusedLearnFiles(files);
    await qc.invalidateQueries({ queryKey: ['offers'] }); onClose();
  };
  const field = (id: string, label: string, el: React.ReactNode) => <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{el}</div>;

  return <ResponsiveSheet open={!!offer} onOpenChange={o => !o && onClose()} title={offer?.id ? t('offers.edit') : bundleMode ? t('resources.create.types.bundle.name') : t('offers.new')} description={bundleMode ? t('resources.preset.bundle.hint') : undefined}>
    <div className="edit-form">
      <div className="form-field"><span className="field-label">{t('offers.type')}</span>
        <div className="choice-pair offer-kinds" role="group" aria-label={t('offers.type')}>{KINDS.map(k => <button key={k} type="button" disabled={!!offer?.id} className={`choice-card ${f.kind === k ? 'is-selected' : ''}`} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}><strong>{t(`offers.kind.${k}`)}</strong><small>{t(`offers.kindText.${k}`)}</small></button>)}</div></div>
      <LangFields idPrefix="of" titleEn={f.title_en} titleEs={f.title_es} descEn={f.description_en} descEs={f.description_es}
        onChange={p => setF(x => ({ ...x, title_en: p.titleEn ?? x.title_en, title_es: p.titleEs ?? x.title_es, description_en: p.descEn ?? x.description_en, description_es: p.descEs ?? x.description_es }))}
        titleLabel={t('templates.title')} descLabel={t('offers.description')} descMax={1200} titlePlaceholder={t('offers.titlePlaceholder')} />
      <LangPair id="of-inc" label={t('offers.includes')} en={f.inc_en} es={f.inc_es} onEn={v => setF({ ...f, inc_en: v })} onEs={v => setF({ ...f, inc_es: v })} multiline rows={3} placeholder={t('offers.includesPlaceholder')} />
      {field('of-price', f.kind === 'download' ? t('offers.price') : t('offers.priceMonthly'), <Input id="of-price" className="field-input" inputMode="decimal" value={f.price} placeholder="0" onChange={e => setF({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') })} />)}
      {priceNum > 0 && <RefundSelect id="of-refund" value={f.refund} onChange={v => setF({ ...f, refund: v })} />}
      <p className="muted-small">{t('offers.feeNote')}</p>
      {field('of-cseats', t('community.seatsField'), <Input id="of-cseats" className="field-input" inputMode="numeric" value={f.c_seats} placeholder={t('community.seatsNone')} onChange={e => setF({ ...f, c_seats: e.target.value.replace(/\D/g, '').slice(0, 3) })} />)}
      <p className="muted-small">{t('community.seatsHint')}</p>
      {f.kind === 'membership' && <div className="bilingual">
        {field('of-fseats', t('offers.foundingSeats'), <Input id="of-fseats" className="field-input" inputMode="numeric" value={f.f_seats} placeholder="0" onChange={e => setF({ ...f, f_seats: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />)}
        {field('of-fprice', t('offers.foundingPrice'), <Input id="of-fprice" className="field-input" inputMode="decimal" value={f.f_price} placeholder="0" disabled={!Number(f.f_seats)} onChange={e => setF({ ...f, f_price: e.target.value.replace(/[^0-9.]/g, '') })} />)}
      </div>}
      {f.kind === 'membership' && <p className="muted-small">{t('offers.foundingHelp')}</p>}
      {f.kind === 'course' && field('of-drip', t('offers.drip'), <Input id="of-drip" className="field-input" type="number" min={0} max={60} value={f.drip_days} onChange={e => setF({ ...f, drip_days: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />)}
      {f.kind !== 'download' && <p className="muted-small">{t(f.kind === 'course' ? 'offers.courseHelp' : 'offers.membershipHelp')}</p>}
      {f.kind === 'download' && <div className="form-field"><span className="field-label">{t('offers.file')}</span>
        <label className="file-button"><Upload />{f.file_path ? t('offers.replaceFile') : t('offers.uploadFile')}
          <input type="file" accept="application/pdf,.pdf,.epub,.zip" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 100 * 1024 * 1024) { toast.error(t('offers.fileTooBig')); return; } setBusy(true); try { setF(v => ({ ...v, file_path: '' })); const p = await uploadOfferFile(userId, file); setF(v => ({ ...v, file_path: p })); toast.success(t('offers.fileReady')); } catch { toast.error(t('offers.uploadError')); setF(v => ({ ...v, file_path: null })); } setBusy(false); }} /></label>
        {f.file_path && <small className="muted-small"><Check className="inline-icon" />{t('offers.fileAttached')}</small>}</div>}
      <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
        <OfferCover offer={f} wide preview={coverPreview} />
        <div className="photo-row flex-wrap">
          <Button asChild variant="secondary"><label className="file-button"><Upload />{t('onboarding.uploadCover')}<CropFileInput kind="cover" onCropped={r => { setCoverFile(r.file); setCoverPreview(r.previewUrl); }} onRejected={() => toast.error(t('gathering.photoTooBig'))} /></label></Button>
          {(coverFile || f.cover_url) && <Button variant="ghost" onClick={() => { setCoverFile(null); setCoverPreview(null); setF(v => ({ ...v, cover_url: null })); }}>{t('onboarding.removePhoto')}</Button>}
        </div>
        <div className="cover-styles" role="group" aria-label={t('onboarding.cover')}>{COVER_STYLES.map((bg, i) => <button key={i} type="button" className={`cover-swatch ${f.cover_style === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} aria-label={`${t('onboarding.cover')} ${i + 1}`} aria-pressed={f.cover_style === i} onClick={() => setF({ ...f, cover_style: i })} />)}</div></div>
      <label className="switch-row"><Switch checked={f.publish} onCheckedChange={v => setF({ ...f, publish: v })} /><span><strong>{t('offers.publish')}</strong><small>{t(f.kind === 'download' && !f.file_path ? 'offers.publishNeedsFile' : 'offers.publishText')}</small></span></label>
      <Button className="onboarding-continue" disabled={!valid || busy} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {offer?.id && offer.status === 'draft' && <Button variant="ghost" onClick={remove}>{t('offers.delete')}</Button>}
    </div>
  </ResponsiveSheet>;
}

/* ---------- Offer page (Join / Buy) ---------- */
export function OfferPage({ id, paid, panel }: { id: string; paid?: boolean; panel?: string | undefined }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const q = useQuery({ ...offerQuery(id, userId), refetchInterval: paid ? 4000 : false });
  const access = useQuery(canAccessOfferQuery(id, userId));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data: gate } = useQuery(paymentsStatusQuery);
  const checkout = useServerFn(startOfferCheckout);
  const download = useServerFn(offerDownloadLink);
  const [busy, setBusy] = useState(false); const [promo, setPromo] = useState<Promo | null>(null);
  const { data: founding } = useQuery({ ...foundingStatusQuery(id), enabled: !!q.data?.offer?.founding_seats });
  const isHost = q.data?.offer?.host_id === userId;
  useEffect(() => {
    if (panel !== 'quiz' || !isHost) return;
    const el = document.getElementById('quiz-panel');
    if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [panel, isHost]);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const { offer, purchase, hostName } = q.data;
  if (!offer) return <section className="panel empty-state"><Lock /><p>{t('offers.notFound')}</p></section>;
  const owned = isLive(purchase) || offer.host_id === userId || access.data === true;
  const includes = offerIncludes(offer, lang);
  const foundingOpen = offer.kind === 'membership' && !!founding && founding.left > 0;
  const buy = async () => {
    setBusy(true);
    try {
      if (!offer.price_cents || (foundingOpen && founding.price_cents === 0)) { const { error } = await joinFreeOffer(offer.id); if (error) throw error; toast.success(t(offer.kind === 'download' ? 'offers.unlocked' : 'offers.joined')); await qc.invalidateQueries({ queryKey: ['offers'] }); }
      else {
        const r = await checkout({ data: { offerId: offer.id, origin: window.location.origin, lang: lang === 'es' ? 'es' : 'en', promo: promo?.code ?? '' } });
        if (r.ok) { window.location.href = r.url; return; }
        toast.error(t(`offers.errors.${r.error}`, { defaultValue: t('offers.errors.generic') }));
      }
    } catch { toast.error(t('offers.errors.generic')); }
    setBusy(false);
  };
  const getFile = async () => {
    setBusy(true);
    const r = await download({ data: { offerId: offer.id } });
    setBusy(false);
    if (r.ok) window.open(r.url, '_blank', 'noopener'); else toast.error(t('offers.errors.download'));
  };

  return <article className="offer-page">
    <OfferCover offer={offer} wide />
    <section className="panel offer-body">
      <h1>{offerTitle(offer, lang)}</h1>
      {hostName && <p className="muted-small">{t('offers.by', { name: hostName })}<OfferSeal id={offer.host_id} /><FoundingSeal id={offer.host_id} /></p>}
      <p className="offer-price">{priceLabel(t, offer, lang)}</p>
      {!!offer.price_cents && <RefundLine policy={(offer as { refund_policy?: string }).refund_policy} />}
      {offer.kind === 'membership' && founding && <div className={`founding-card ${founding.left ? '' : 'is-full'}`} role="status">
        <strong>{founding.left ? t('offers.foundingLeft', { left: founding.left, seats: founding.seats }) : t('offers.foundingFull', { seats: founding.seats })}</strong>
        {founding.left > 0 && <span>{t('offers.foundingPriceLine', { price: founding.price_cents ? formatMoney(founding.price_cents, lang) : t('offers.free') })}</span>}
      </div>}
      {offerText(offer, lang) && <p className="offer-description">{offerText(offer, lang)}</p>}
      {includes.length > 0 && <><h2>{t('offers.whatsIncluded')}</h2><ul className="offer-includes">{includes.map((x, i) => <li key={i}><Check />{x}</li>)}</ul></>}
      {offer.kind === 'course' && offer.drip_days > 0 && <p className="muted-small">{t('offers.dripNote', { count: offer.drip_days })}</p>}
      {paid && !owned && <p className="muted-small" role="status">{t('offers.confirming')}</p>}
      {owned ? <div className="offer-owned">
        <span className="chip"><Check className="inline-icon" />{t(offer.host_id === userId ? 'offers.yours' : offer.kind === 'download' ? 'offers.owned' : 'offers.member')}</span>
        {offer.kind === 'download' && offer.file_path && <Button disabled={busy} onClick={getFile}><Download />{t('offers.download')}</Button>}
        {offer.kind === 'membership' && <Button asChild variant="secondary"><Link to="/events"><CalendarDays />{t('offers.seeGatherings')}</Link></Button>}
      </div> : offer.status === 'published' ? <>
        {!!offer.price_cents && <PromoField kind="offer" target={offer.id} discountCents={promoDiscount(offer.price_cents, promo)} value={promo} onChange={setPromo} />}
        {promo && !!offer.price_cents && <p className="offer-price">{formatMoney(offer.price_cents - promoDiscount(offer.price_cents, promo), lang)}</p>}
        <Button className="onboarding-continue" disabled={busy} onClick={buy}>{t(offer.kind === 'download' ? 'offers.buy' : 'offers.join')}</Button>
        {!!offer.price_cents && gate && !gate.connected && <p className="muted-small">{t('billing.notConnected')}</p>}
        {offer.kind !== 'download' && !!offer.price_cents && <ul className="member-promises"><li><Check />{t('offers.cancelAnytime')}</li><li><Check />{t('offers.pauseAnytime')}</li></ul>}
        {!!offer.price_cents && <CommunitySeatCard kind="offer" target={offer.id} signedIn={!!userId} />}
      </> : <p className="muted-small">{t('offers.closed')}</p>}
      {offer.host_id === userId && <CommunityRequestsPanel kind="offer" target={offer.id} seats={offer.community_seats} />}
    </section>
    {offer.host_id === userId && <>
      <section className="panel"><div className="section-heading"><h2>{t('content.hostTools')}</h2></div>
        <OfferHostActions offer={offer} onChanged={() => void qc.invalidateQueries({ queryKey: ['offers'] })} />
        <div className="offer-host-actions">
          <Button variant="secondary" size="sm" onClick={() => setDetailsOpen(true)}><Pencil />{t('content.details')}</Button>
          {(offer.status === 'published') && <PublicOfferLink id={offer.id} />}
        </div>
      </section>
      <ReadinessPanel offerId={offer.id} onEdit={() => setDetailsOpen(true)} />
      {offer.kind !== 'download' ? <CurriculumPanel offer={offer} /> : <BundlePanel offer={offer} />}
      {offer.kind !== 'download' && <>
        <QuizPanel offer={offer} />
        <CertificateSettings offer={offer} />
        <LearnerProgressPanel offerId={offer.id} />
      </>}
      <OfferDetailsEditor offer={detailsOpen ? offer : null} onClose={() => setDetailsOpen(false)} />
    </>}
    {offer.kind === 'download' && owned && offer.file_path && <OwnedFileViewer offerId={offer.id} title={offerTitle(offer, lang)} />}
    {offer.kind === 'download' && owned && <BundleReader offerId={offer.id} userId={userId} />}
    {offer.kind !== 'download' && owned && offer.host_id !== userId && <>
      <CourseProgressPanel offerId={offer.id} isHost={false} />
      <LearnerQuizList offerId={offer.id} />
    </>}
    {offer.kind !== 'download' && offer.host_id === userId && <CourseProgressPanel offerId={offer.id} isHost />}
  </article>;
}

/* ---------- Team members: offers from my team ---------- */
export function TeamOffersStrip({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data = [] } = useQuery(teamOffersQuery(teamId));
  if (!data.length) return null;
  return <section className="panel"><div className="section-heading"><h2>{t('offers.fromTeam')}</h2></div>
    <ul className="offer-list compact">{data.slice(0, 6).map(o => <li key={o.id}><Link to="/offer/$id" params={{ id: o.id }} className="offer-row is-link"><OfferCover offer={o} /><div className="offer-row-main"><strong>{offerTitle(o, lang)}</strong><small>{priceLabel(t, o, lang)}</small></div><ChevronRight /></Link></li>)}</ul>
  </section>;
}

/* ---------- Me → Purchases ---------- */
export function PurchasesPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const q = useQuery(purchasesQuery(userId));
  const cancel = useServerFn(cancelOfferMembership); const pause = useServerFn(pauseOfferMembership);
  const download = useServerFn(offerDownloadLink);
  const [busy, setBusy] = useState<string | null>(null);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!q.data.length) return <div><EmptyState compact icon="Gift" text={t('offers.noPurchases')} /></div>;
  const memberships = q.data.filter(p => p.offer && p.offer.kind !== 'download');
  const downloads = q.data.filter(p => p.offer?.kind === 'download');
  const doCancel = async (offerId: string) => {
    if (!(await confirmAction({ title: t('offers.confirmCancel'), destructive: true, confirmLabel: t('confirm.yesCancel') }))) return;
    setBusy(offerId);
    const r = await cancel({ data: { offerId } });
    setBusy(null);
    if (!r.ok) { toast.error(t(r.error === 'not_connected' ? 'billing.notConnected' : 'offers.errors.generic')); return; }
    toast.success(t(r.ended ? 'offers.cancelled' : 'offers.cancelScheduled'));
    await qc.invalidateQueries({ queryKey: ['offers'] });
  };
  const doPause = async (offerId: string, months: number) => {
    setBusy(offerId); const r = await pause({ data: { offerId, months } }); setBusy(null);
    if (!r.ok) { toast.error(t(r.error === 'not_connected' ? 'billing.notConnected' : 'offers.errors.generic')); return; }
    toast.success(months ? t('offers.pausedToast', { date: dateFmt(r.until!, lang) }) : t('offers.resumedToast'));
    await qc.invalidateQueries({ queryKey: ['offers'] });
  };
  const getFile = async (offerId: string) => { setBusy(offerId); const r = await download({ data: { offerId } }); setBusy(null); if (r.ok) window.open(r.url, '_blank', 'noopener'); else toast.error(t('offers.errors.download')); };
  const statusText = (p: (typeof q.data)[number]) => {
    if (p.status === 'canceled') return t('offers.status.ended');
    if (p.paused_until && new Date(p.paused_until) > new Date()) return t('offers.pausedUntil', { date: dateFmt(p.paused_until, lang) });
    if (p.status === 'past_due') return t('offers.status.pastDue');
    if (p.cancel_at_period_end && p.renews_at) return t('offers.endsOn', { date: dateFmt(p.renews_at, lang) });
    if (p.renews_at) return t('offers.renewsOn', { date: dateFmt(p.renews_at, lang) });
    return t('offers.status.active');
  };
  return <div className="purchases">
    {memberships.length > 0 && <><h3 className="field-label">{t('offers.memberships')}</h3>
      <ul className="offer-list compact">{memberships.map(p => <li key={p.id} className="offer-row">
        {p.offer && <OfferCover offer={p.offer} />}
        <div className="offer-row-main"><Link to="/offer/$id" params={{ id: p.offer_id }}><strong>{offerTitle(p.offer!, lang)}</strong></Link><small>{priceLabel(t, p.offer!, lang)} · {statusText(p)}</small></div>
        {isLive(p) && !p.cancel_at_period_end && <div className="offer-row-actions">
          {p.paused_until && new Date(p.paused_until) > new Date() ? <Button variant="ghost" disabled={busy === p.offer_id} onClick={() => doPause(p.offer_id, 0)}>{t('offers.resume')}</Button>
            : <select className="field-input pause-select" aria-label={t('offers.pause')} value="" disabled={busy === p.offer_id} onChange={e => { const m = Number(e.target.value); if (m) void doPause(p.offer_id, m); }}><option value="">{t('offers.pause')}</option>{[1, 2, 3].map(m => <option key={m} value={m}>{t('offers.pauseMonths', { count: m })}</option>)}</select>}
          <Button variant="ghost" disabled={busy === p.offer_id} onClick={() => doCancel(p.offer_id)}>{t('offers.cancel')}</Button></div>}
      </li>)}</ul></>}
    {downloads.length > 0 && <><h3 className="field-label">{t('offers.downloads')}</h3>
      <ul className="offer-list compact">{downloads.map(p => <li key={p.id} className="offer-row">
        {p.offer && <OfferCover offer={p.offer} />}
        <div className="offer-row-main"><strong>{offerTitle(p.offer!, lang)}</strong><small>{t('offers.receipt', { amount: p.amount_cents ? formatMoney(p.amount_cents, lang) : t('offers.free'), date: dateFmt(p.created_at, lang) })}</small></div>
        {isLive(p) && <Button variant="secondary" size="icon" aria-label={t('offers.download')} disabled={busy === p.offer_id} onClick={() => getFile(p.offer_id)}><Download /></Button>}
      </li>)}</ul></>}
    <p className="muted-small">{t('offers.receiptsNote')}</p>
  </div>;
}

/* ---------- Members-only picker (gatherings and tracks) ---------- */
export function MembersOnlyPicker({ table, id, teamId }: { table: 'events' | 'tracks'; id: string; teamId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const { data: offers = [] } = useQuery(linkableOffersQuery(userId, teamId));
  const { data: current = null } = useQuery({ queryKey: ['offer-link', table, id], queryFn: () => getOfferLink(table, id) });
  if (!offers.length && !current) return null;
  const change = async (v: string) => {
    const { error } = await setOfferLink(table, id, v || null);
    if (error) { toast.error(t('offers.errors.generic')); return; }
    toast.success(t(v ? 'offers.nowMembersOnly' : 'offers.nowOpen'));
    await qc.invalidateQueries({ queryKey: ['offer-link', table, id] });
  };
  return <div className="form-field members-only"><label className="field-label" htmlFor={`mo-${id}`}><Lock className="inline-icon" />{t('offers.membersOnly')}</label>
    <select id={`mo-${id}`} className="field-input" value={current ?? ''} onChange={e => void change(e.target.value)}>
      <option value="">{t('offers.openToAll')}</option>
      {offers.map(o => <option key={o.id} value={o.id}>{offerTitle(o, lang)}</option>)}
    </select>
    <small className="muted-small">{t(table === 'events' ? 'offers.membersOnlyEvent' : 'offers.membersOnlyTrack')}</small></div>;
}

function OfferSeal({ id }: { id: string }) { return useIsVerified(id) ? <> <VerifiedMark compact /></> : null; }

/** Owners of a PDF download read it inline with Open/Download; other file types keep the Download button. */
function OwnedFileViewer({ offerId, title }: { offerId: string; title: string }) {
  const download = useServerFn(offerDownloadLink);
  const q = useQuery({ queryKey: ['offer-file-view', offerId], queryFn: () => download({ data: { offerId, inline: true } }), staleTime: 8 * 60_000, retry: 1 });
  if (q.data?.ok && !q.data.pdf) return null;
  return <section className="panel"><DocumentViewer src={q.data?.ok ? q.data.viewUrl : null} downloadSrc={q.data?.ok ? q.data.url : undefined} title={title}
    loading={q.isLoading} error={q.isError || (q.isFetched && !q.data?.ok)} onRetry={() => void q.refetch()} /></section>;
}
