import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ShareKit } from '@/components/share-kit';
import { CopyButton } from '@/components/copy-button';
import { EmptyState } from '@/components/launch-states';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { UserPlus, Check, X, Copy, CalendarDays, Share2, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { Avatar } from '@/components/me-page';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { teamsQuery } from '@/lib/account';
import { featuredQuery, netRpc, networkQuery, partnerLink, type NetGathering, type NetPerson } from '@/lib/network';

function when(iso: string, tz: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-419' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(iso));
}

export function NetworkPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const q = useQuery(networkQuery(userId));
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const myHostTeams = teams.filter(team => team.role !== 'member');
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(key);
    try { await netRpc(fn, args); toast.success(t(ok)); await qc.invalidateQueries({ queryKey: ['network'] }); await qc.invalidateQueries({ queryKey: ['network-featured'] }); }
    catch { toast.error(t('network.error')); }
    setBusy(null);
  };

  const person = (p: NetPerson, actions: React.ReactNode) => <div key={p.user_id} className="person-row network-person">
    <Avatar path={p.avatar} name={p.name} size={44} />
    <div className="person-info"><h3>{p.name ?? t('common.name')}</h3>{p.city && <p>{p.city}</p>}</div>
    <div className="network-actions">{actions}</div>
  </div>;

  const [kit, setKit] = useState<NetGathering | null>(null);
  const gathering = (g: NetGathering) => <div key={g.id} className="network-gathering">
    <div className="person-info">
      <Link to="/e/$id" params={{ id: g.id }} className="network-title">{g.title}</Link>
      <p><CalendarDays className="inline-icon" />{when(g.starts_at, g.timezone, lang)}{g.location_name ? ` · ${g.location_name}` : g.online ? ` · ${t('network.online')}` : ''}</p>
      <p className="muted-small">{g.mine ? t('network.yours') : t('network.hostedBy', { name: g.host_name ?? '' })}</p>
    </div>
    {!g.mine && <div className="network-actions">
      <CopyButton text={partnerLink(g.id, userId)} label={t('network.copyGuestLink')} />
      <Button variant="secondary" onClick={() => setKit(g)}><Share2 />{t('shareKit.open')}</Button>
      {myHostTeams.map(team => { const on = g.featured_teams.includes(team.teamId); return <Button key={team.teamId} variant={on ? 'default' : 'secondary'} aria-pressed={on} disabled={busy === g.id + team.teamId}
        onClick={() => act(g.id + team.teamId, 'network_feature', { _event: g.id, _team: team.teamId, _on: !on }, on ? 'network.unfeatured' : 'network.featured')}>
        {on ? <Check /> : <Share2 />}{myHostTeams.length > 1 ? t(on ? 'network.featuredFor' : 'network.featureFor', { team: team.name }) : t(on ? 'network.featuredShort' : 'network.feature')}</Button>; })}
    </div>}
  </div>;

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('home.networkLabel', { defaultValue: lang === 'es' ? 'TU RED DE ANFITRIONES' : 'YOUR HOST NETWORK' })}</span><h1>{t('network.title')}</h1><p>{t('network.subtitle')}</p></div></div>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data.is_host ? <section className="panel"><p className="auth-subtitle">{t('network.hostsOnly')}</p></section> : <>
      {q.data.incoming.length > 0 && <section className="panel"><div className="section-heading"><h2>{t('network.requests')}</h2></div>
        {q.data.incoming.map(p => person(p, <>
          <Button disabled={busy === p.link_id} onClick={() => act(p.link_id!, 'network_respond', { _link: p.link_id, _accept: true }, 'network.accepted')}><Check />{t('network.accept')}</Button>
          <Button variant="ghost" size="icon" aria-label={t('network.decline')} disabled={busy === p.link_id} onClick={() => act(p.link_id!, 'network_respond', { _link: p.link_id, _accept: false }, 'network.declined')}><X /></Button></>))}
      </section>}

      <section className="panel"><div className="section-heading"><h2>{t('network.fromNetwork')}</h2></div>
        {q.data.gatherings.length ? q.data.gatherings.map(gathering) : <EmptyState compact icon="UsersRound" text={t('network.noGatherings')} />}
      </section>

      <section className="panel"><div className="section-heading"><h2>{t('network.connections')}</h2><span className="chip">{q.data.connections.length}</span></div>
        {q.data.connections.length ? q.data.connections.map(p => person(p, <Button variant="ghost" disabled={busy === p.link_id} onClick={() => act(p.link_id!, 'network_remove', { _link: p.link_id }, 'network.removed')}>{t('network.remove')}</Button>)) : <EmptyState compact icon="UsersRound" text={t('network.noConnections')} />}
        {q.data.outgoing.map(p => person(p, <span className="chip">{t('network.pending')}</span>))}
      </section>

      <section className="panel"><div className="section-heading"><h2>{t('network.suggested')}</h2></div>
        {q.data.suggested.length ? q.data.suggested.map(p => person(p, <Button variant="secondary" disabled={busy === p.user_id} onClick={() => act(p.user_id, 'network_request', { _to: p.user_id }, 'network.requested')}><UserPlus />{t('network.add')}</Button>)) : <EmptyState compact icon="UsersRound" text={t('network.noSuggested')} />}
      </section>
    </>}
    <ResponsiveSheet open={!!kit} onOpenChange={o => !o && setKit(null)} title={t('shareKit.open')} description={kit?.title}>
      {kit && <ShareKit title={kit.title} startsAt={kit.starts_at} timezone={kit.timezone} place={kit.location_name ?? (kit.online ? t('network.online') : '')} link={partnerLink(kit.id, userId)} />}
    </ResponsiveSheet>
  </>;
}

/** Partner gatherings a host or leader featured for this team. */
export function FeaturedFromNetwork({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const { data = [], isError } = useQuery({ ...featuredQuery(teamId), retry: 1 });
  if (isError || !data.length) return null;
  return <section className="panel"><div className="section-heading"><h2>{t('network.partnerGatherings')}</h2></div>
    {data.map(g => <Link key={g.id} to="/e/$id" params={{ id: g.id }} className="network-gathering is-link">
      <div className="person-info"><h3>{g.title}</h3><p>{when(g.starts_at, g.timezone, i18n.resolvedLanguage ?? 'en')}{g.location_name ? ` · ${g.location_name}` : ''}</p><p className="muted-small">{t('network.sharedBy', { host: g.shared_by ?? '' })}</p></div>
      <ChevronRight className="settings-chevron" /></Link>)}
  </section>;
}
