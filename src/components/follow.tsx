import { FoundingSeal } from '@/components/founding';
import { CoachTrustSection, VerifiedMark, useIsVerified } from '@/components/coach-trust';
import { CopyButton, ShareButton } from '@/components/copy-button';
import { FeaturedBadges } from '@/components/recognition';
import { publicHostCover } from '@/lib/host-cover.functions';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { BrandImage } from '@/components/brand-image';
import { GatheringCover } from '@/components/gathering-cover';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { formatWhen } from '@/lib/guest';
import { initialsOf, mediaUrl } from '@/lib/account';

type Upcoming = { id: string; title: string; starts_at: string; timezone: string; location_name: string | null; online: boolean; cover_style: number | null };
type HostOffering = { kind: string; id: string; title: string; summary: string | null; price_cents: number | null };
type HostLink = { label: string; url: string; kind: 'website' | 'social' };
type HostPage = { id: string; name: string | null; org: string | null; avatar_url: string | null; cover_url: string | null; coverSrc?: string | null; city: string | null; bio: string | null; shop_url: string | null; categories: string[]; languages: string[]; accessibility: string | null; links: HostLink[]; followers: number; following: boolean; upcoming: Upcoming[]; offerings: HostOffering[] };
type TeamPage = { id: string; name: string; cover_url: string | null; leader: { name: string | null; slug: string | null; avatar_url: string | null } | null; members: number; followers: number; following: boolean; upcoming: Upcoming[] };

export const pageQuery = (kind: 'host' | 'team', slug: string) => ({
  queryKey: ['public-follow-page', kind, slug],
  queryFn: async () => {
    const { data, error } = kind === 'host' ? await supabase.rpc('get_public_host', { _slug: slug }) : await supabase.rpc('get_public_team', { _slug: slug });
    if (error) throw error;
    if (kind === 'host' && data) return { ...(data as unknown as HostPage), coverSrc: await publicHostCover({ data: { slug } }).catch(() => null) };
    return data as unknown as HostPage | TeamPage | null;
  },
});

function HostSeal({ id }: { id: string }) { return useIsVerified(id) ? <> <VerifiedMark compact /></> : null; }

function Avatar({ path, name, size = 96 }: { path: string | null; name: string | null; size?: number }) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  return url ? <img src={url} alt={name ?? ''} className="follow-avatar" width={size} height={size} loading="lazy" decoding="async" /> : <span className="follow-avatar is-initials" aria-hidden="true">{initialsOf(name)}</span>;
}

export function FollowPage({ kind, slug }: { kind: 'host' | 'team'; slug: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery(pageQuery(kind, slug));
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const d = q.data;
  if (!d) return <EmptyState icon="Compass" title={t('follow.notFoundTitle')} text={t('follow.notFound')} action={<Button asChild variant="secondary"><Link to="/discover">{t('follow.discover')}</Link></Button>} />;
  const host = kind === 'host' ? d as HostPage : null; const team = kind === 'team' ? d as TeamPage : null;
  const name = host?.name ?? team?.name ?? '';
  const avatarPath = host?.avatar_url ?? team?.leader?.avatar_url ?? null;
  return <div className="follow-page">
    <section className="gw-hero-card follow-hero">
      {host ? <BrandImage src={host.coverSrc} alt={name} className="gw-hero-cover profile-photo-cover" priority /> : <BrandImage slot="host_band" alt="" className="gw-hero-cover" />}
      <div className="follow-hero-body">
        <Avatar path={avatarPath} name={name} />
        <p className="eyebrow">{t(kind === 'host' ? 'follow.hostLabel' : 'follow.teamLabel')}</p>
        <h1 className="follow-name">{name}{host && <HostSeal id={host.id} />}{host && <FoundingSeal id={host.id} />}</h1>
        {host?.org && <p className="follow-org">{host.org}</p>}
        <p className="follow-meta">{[host?.city, team ? t('follow.members', { count: team.members }) : null, t('follow.followers', { count: d.followers })].filter(Boolean).join(' · ')}</p>
        {team?.leader?.name && <p className="follow-meta">{t('follow.ledBy')} {team.leader.slug ? <Link to="/h/$slug" params={{ slug: team.leader.slug }}>{team.leader.name}</Link> : team.leader.name}</p>}
        {host?.bio && <p className="follow-bio">{host.bio}</p>}
        {host && (host.categories.length > 0 || host.languages.length > 0) && <ul className="follow-chips" aria-label={t('hostProfile.categories')}>
          {host.categories.map(c => <li key={c} className="discover-chip is-static">{c}</li>)}
          {host.languages.map(l => <li key={l} className="discover-chip is-static">{t(l === 'es' ? 'me.spanish' : 'me.english')}</li>)}
        </ul>}
        {host?.accessibility && <p className="follow-accessibility"><GwIcon name="HeartHandshake" />{host.accessibility}</p>}
        {host && <FeaturedBadges userId={host.id} />}
        <div className="follow-actions"><FollowButton kind={kind} target={d.id} following={d.following} slug={slug} />
          {host?.shop_url && <Button asChild variant="secondary"><a href={host.shop_url} target="_blank" rel="noopener noreferrer"><GwIcon name="ExternalLink" />{t('follow.shop')}</a></Button>}</div>
        {host && host.links.length > 0 && <ul className="follow-links">{host.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer" className="auth-link"><GwIcon name={l.kind === 'social' ? 'AtSign' : 'Link2'} />{l.label || l.url.replace(/^https:\/\//, '')}</a></li>)}</ul>}
      </div>
    </section>
    {host && <CoachTrustSection hostId={host.id} />}
    {host && host.offerings.length > 0 && <section className="follow-upcoming">
      <h2>{t('follow.offerings')}</h2>
      <ul className="follow-list">{host.offerings.map(o => <li key={o.id}><Link to="/o/$id" params={{ id: o.id }} className="follow-event">
        <span><strong>{o.title}</strong><small>{t(`offers.kind_${o.kind}`)}{o.price_cents ? '' : ` · ${t('offers.free')}`}</small></span>
        <GwIcon name="ChevronRight" /></Link></li>)}</ul>
    </section>}
    <section className="follow-upcoming">
      <h2>{t('follow.upcoming')}</h2>
      {d.upcoming.length ? <ul className="follow-list">{d.upcoming.map(e => <li key={e.id}><Link to="/e/$id" params={{ id: e.id }} className="follow-event">
        <GatheringCover style={e.cover_style} title={e.title} className="follow-event-cover" />
        <span><strong>{e.title}</strong><small>{formatWhen(e.starts_at, i18n.resolvedLanguage ?? 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: e.timezone || undefined })}</small><small>{e.location_name ?? (e.online ? t('follow.online') : '')}</small></span>
        <GwIcon name="ChevronRight" /></Link></li>)}</ul>
        : <EmptyState compact icon="CalendarDays" text={t('follow.noUpcoming', { name })} />}
    </section>
  </div>;
}

export function FollowButton({ kind, target, following, slug }: { kind: 'host' | 'team' | 'location'; target: string; following: boolean; slug: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [email, setEmail] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: kind === 'location' ? ['public-location', slug] : ['public-follow-page', kind, slug] });
  const follow = async (withEmail?: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('follow_target', { _kind: kind, _target: target, ...(withEmail ? { _email: withEmail } : {}), _lang: i18n.resolvedLanguage === 'es' ? 'es' : 'en' });
    setBusy(false);
    if (error) { toast.error(t(/invalid_email/.test(error.message) ? 'follow.badEmail' : /self_follow/.test(error.message) ? 'follow.self' : /rate_limited/.test(error.message) ? 'follow.slowDown' : 'error.message')); return; }
    setSheet(false); toast.success(t(withEmail ? 'follow.emailDone' : 'follow.done')); void refresh();
  };
  const click = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setSheet(true); return; }
    if (following) {
      if (!(await confirmAction({ title: t('follow.unfollowTitle'), confirmLabel: t('follow.unfollow') }))) return;
      setBusy(true);
      await supabase.from('follows').delete().eq('target_kind', kind).eq('target_id', target).eq('follower_id', data.user.id);
      setBusy(false); void refresh(); return;
    }
    void follow();
  };
  return <>
    <Button variant={following ? 'secondary' : 'default'} disabled={busy} aria-pressed={following} onClick={() => void click()}><GwIcon name={following ? 'Check' : 'BellRing'} />{t(following ? 'follow.following' : 'follow.follow')}</Button>
    <ResponsiveSheet open={sheet} onOpenChange={setSheet} icon="BellRing" title={t('follow.emailTitle')} description={t('follow.emailText')}
      footer={<Button className="w-full" type="submit" form="follow-email-form" disabled={busy || !email.includes('@')}>{t('follow.follow')}</Button>}>
      <form id="follow-email-form" onSubmit={event => { event.preventDefault(); if (!busy) void follow(email.trim()); }}><div className="field"><Label htmlFor="follow-email">{t('follow.email')}</Label><Input id="follow-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} /></div></form>
      <p className="follow-fine">{t('follow.emailFine')} <Link to="/login">{t('follow.signIn')}</Link></p>
    </ResponsiveSheet>
  </>;
}

/** Me: private calendar links plus the person's public page link. */
export function CalendarFeedPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const feeds = useQuery({ queryKey: ['calendar-feeds', userId], queryFn: async () => { const { data, error } = await supabase.rpc('my_calendar_feeds'); if (error) throw error; return data as { me: string; team: string | null }; } });
  const slugs = useQuery({ queryKey: ['my-public-slugs', userId], queryFn: async () => {
    const { data: p } = await supabase.from('profiles').select('slug, active_team_id').eq('id', userId).maybeSingle();
    const { data: tm } = p?.active_team_id ? await supabase.from('teams').select('slug').eq('id', p.active_team_id).maybeSingle() : { data: null };
    return { host: (p as { slug?: string } | null)?.slug ?? null, team: tm?.slug ?? null };
  } });
  const feedUrl = (token: string) => `${window.location.origin}/api/public/calendar/${token}.ics`;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success(t('follow.copied')); } catch { toast.error(t('error.message')); } };
  const reset = async () => {
    if (!(await confirmAction({ title: t('follow.resetTitle'), body: t('follow.resetBody'), confirmLabel: t('follow.reset'), destructive: true }))) return;
    const { error } = await supabase.rpc('reset_calendar_feeds');
    if (error) { toast.error(t('error.message')); return; }
    toast.success(t('follow.resetDone')); void qc.invalidateQueries({ queryKey: ['calendar-feeds', userId] });
  };
  if (feeds.isLoading) return <ListSkeleton rows={2} />;
  if (feeds.isError || !feeds.data) return <RetryState retry={() => void feeds.refetch()} />;
  const row = (label: string, hint: string, token: string) => {
    const url = feedUrl(token);
    const webcal = url.replace(/^https?:/, 'webcal:');
    return <div className="feed-row">
      <GwFeatureTile name="CalendarDays" size={24} /><div className="feed-row-main"><strong>{label}</strong><small>{hint}</small>
      <div className="feed-actions">
        <CopyButton text={url} label={t('follow.copyLink')} />
        <ShareButton url={url} />
        <Button asChild variant="secondary"><a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer"><GwIcon name="ExternalLink" />{t("follow.googleCalendar")}</a></Button>
        <Button asChild variant="secondary"><a href={webcal}><GwIcon name="CalendarPlus" />{t('follow.appleOutlook')}</a></Button>
      </div></div>
    </div>;
  };
  return <div className="feed-panel">
    <p className="feed-privacy"><GwIcon name="Lock" />{t("follow.feedIntro")}</p>
    {row(t('follow.myFeed'), t('follow.myFeedHint'), feeds.data.me)}
    {feeds.data.team && row(t('follow.teamFeed'), t('follow.teamFeedHint'), feeds.data.team)}
    <Button className="feed-reset" variant="ghost" onClick={() => void reset()}><GwIcon name="RefreshCw" />{t('follow.reset')}</Button>
    {(slugs.data?.host || slugs.data?.team) && <div className="feed-row"><GwFeatureTile name="Link2" size={24} /><div className="feed-row-main"><strong>{t('follow.publicPages')}</strong><small>{t('follow.publicPagesHint')}</small><div className="feed-actions">
      {slugs.data.host && <CopyButton text={`${window.location.origin}/h/${slugs.data.host}`} icon={<GwIcon name="Link2" />} label={t('follow.myPage')} />}
      {slugs.data.team && <CopyButton text={`${window.location.origin}/t/${slugs.data.team}`} icon={<GwIcon name="Link2" />} label={t('follow.teamPage')} />}
    </div></div></div>}
  </div>;
}
