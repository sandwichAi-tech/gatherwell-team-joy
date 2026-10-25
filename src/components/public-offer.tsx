import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Lock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GuestShell } from '@/components/guest-shell';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { canAccessOfferQuery, enrollFree, enrollmentState, publicOfferQuery, type PublicOffer } from '@/lib/content';
import { offerIncludes, offerText, offerTitle } from '@/lib/offers';
import { COVER_STYLES } from '@/lib/gatherings';
import { formatMoney } from '@/lib/billing';
import { minutesLabel } from '@/components/learn';
import { rememberNext } from '@/lib/return-to';
import { BrandImage } from '@/components/brand-image';
import { RichTextView } from '@/components/rich-text';
import { publicOfferCover } from '@/lib/host-cover.functions';
import { accentPair } from '@/lib/resource-item';

/** Client-only session check; the page server-renders signed-out either way. */
function useUserId() {
  const [userId, setUserId] = useState('');
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? '')); }, []);
  return userId;
}

function priceLine(o: PublicOffer, lang: string, t: import('i18next').TFunction) {
  if (!o.price_cents) return t('offers.free');
  const m = formatMoney(o.price_cents, lang);
  if (o.billing_interval) return t('offers.perMonth', { price: m });
  return m;
}

export function PublicOfferPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = useUserId();
  const q = useQuery(publicOfferQuery(id));
  const access = useQuery({ ...canAccessOfferQuery(id, userId), enabled: !!userId });
  const coverPath = q.data?.cover_url ?? null;
  const cover = useQuery({ queryKey: ['public-offer-cover', id], queryFn: () => publicOfferCover({ data: { id } }), enabled: !!coverPath, staleTime: 50 * 60 * 1000 });
  const [busy, setBusy] = useState(false);

  if (q.isPending) return <GuestShell><ListSkeleton /></GuestShell>;
  if (q.isError) return <GuestShell><RetryState retry={() => void q.refetch()} /></GuestShell>;
  const o = q.data;
  if (!o) return <GuestShell><section className="panel empty-state"><Lock /><p>{t('offers.notFound')}</p></section></GuestShell>;

  const title = offerTitle(o, lang);
  const subtitle = pick2(lang, o.subtitle_en, o.subtitle_es);
  const promo = pick2(lang, o.promo_en, o.promo_es);
  const customCta = pick2(lang, o.cta_en, o.cta_es);
  const pair = accentPair(o.accent ?? 'plum');
  const summary = pick2(lang, o.summary_en, o.summary_es);
  const description = offerText(o, lang);
  const includes = offerIncludes(o, lang);
  const license = pick2(lang, o.license_en, o.license_es);
  const window2 = enrollmentState(o);
  const owned = access.data === true;
  const paid = o.price_cents > 0;

  const enroll = async () => {
    if (!userId) { rememberNext(`/o/${id}`); void navigate({ to: '/login' }); return; }
    setBusy(true);
    const { error } = await enrollFree(id);
    setBusy(false);
    if (error) { toast.error(t('content.enrollError')); return; }
    toast.success(t('content.enrolled'));
    await qc.invalidateQueries({ queryKey: ['offer-access', id] });
    await qc.invalidateQueries({ queryKey: ['my-learning'] });
  };

  return <GuestShell>
    <article className="offer-page">
      <div className="offer-cover is-wide" style={{ backgroundImage: COVER_STYLES[o.cover_style % COVER_STYLES.length] }}>
        {cover.data && <BrandImage src={cover.data} alt={title} className="offer-cover-photo" priority />}
        <span className="chip offer-kind" style={{ background: pair.bg, color: pair.fg }}>{t(`offers.kind.${o.kind}`)}</span>
      </div>
      <section className="panel offer-body">
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {o.host_name && <p className="muted-small">{t('offers.by', { name: o.host_name })}{o.coauthor_name ? ` · ${o.coauthor_name}` : ''}</p>}
        <p className="offer-price">{priceLine(o, lang, t)}</p>
        {paid && <p className="muted-small" role="status">{t('content.paidSetupRequired')}</p>}
        {summary && <p className="offer-description"><strong>{summary}</strong></p>}
        {description && <p className="offer-description">{description}</p>}
        <RichTextView html={promo} className="rich-text offer-promo" />
        {o.tags.length > 0 && <div className="recipe-tags">{o.tags.map(x => <span key={x} className="chip">{x}</span>)}</div>}
        {includes.length > 0 && <><h2>{t('offers.whatsIncluded')}</h2><ul className="offer-includes">{includes.map((x, i) => <li key={i}><Check />{x}</li>)}</ul></>}
        {o.accessibility_notes && <p className="muted-small">{t('content.accessibility')}: {o.accessibility_notes}</p>}
        {o.version_label && <p className="muted-small">{t('content.version', { v: o.version_label })}</p>}
        {license && <p className="muted-small">{license}</p>}

        {o.sections.length > 0 && <>
          <h2>{t('content.curriculum')}</h2>
          <ol className="lesson-list public-curriculum">{o.sections.map(s => <li key={s.id} className="public-section">
            <strong>{pick2(lang, s.title_en, s.title_es)}</strong>
            <ul>{(s.lessons ?? []).map(l => <li key={l.id} className="public-lesson">
              <span>{pick2(lang, l.title_en, l.title_es)}</span>
              <small>{t(`learnHub.type.${l.type}`)}{l.duration_minutes ? ` · ${minutesLabel(t, l.duration_minutes)}` : ''}{l.is_preview ? ` · ${t('content.previewBadge')}` : ''}</small>
            </li>)}</ul>
          </li>)}</ol></>}

        {(o.items ?? []).length > 0 && <>
          <h2>{t('content.bundle')}</h2>
          <ol className="lesson-list public-curriculum">{o.items.map(i => <li key={i.id} className="public-lesson">
            <span>{pick2(lang, i.title_en, i.title_es)}</span>
            <small>{t(`content.itemType.${i.type}`)}{i.is_preview ? ` · ${t('content.previewBadge')}` : ''}{!i.allow_download ? ` · ${t('content.noDownload')}` : ''}</small>
          </li>)}</ol></>}

        {owned ? <div className="offer-owned"><span className="chip"><Check className="inline-icon" />{t('offers.owned')}</span>
          <Button asChild><Link to="/offer/$id" params={{ id }}>{t('content.openInLibrary')}</Link></Button></div> :
          window2 === 'open' && !paid ? <Button className="onboarding-continue" style={{ background: pair.bg, color: pair.fg }} disabled={busy} onClick={enroll}>{customCta || t(userId ? 'content.enrollFree' : 'content.signInToEnroll')}</Button> :
          window2 === 'open' && paid ? <Button className="onboarding-continue" disabled>{t('content.paidSetupRequired')}</Button> :
          <p className="muted-small" role="status">{t(window2 === 'not_yet' ? 'content.enrollNotOpen' : 'content.enrollClosed')}</p>}
        {!userId && !owned && <p className="muted-small">{t('content.guestBrowseNote')}</p>}
      </section>
    </article>
  </GuestShell>;
}

function pick2(lang: string, en?: string | null, es?: string | null) {
  return (lang === 'es' ? es || en : en || es) || '';
}
