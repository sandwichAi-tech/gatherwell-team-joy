import type { ReactNode } from 'react';
import { GatheringCover } from '@/components/gathering-cover';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GwIcon, GwFeatureTile, type GwIconName } from '@/components/gw-icon';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { myChallengesQuery, myGatheringsQuery, profileStatsQuery, recentBadgesQuery, type MyGathering } from '@/lib/profile-stats';

/** Identity-led hero shared by Me and member detail. */
export function ProfileHero({ avatar, name, city, team, role, badge, bio, actions, compact, cover }: {
  cover?: string | null | undefined;
  avatar: ReactNode; name?: string | null | undefined; city?: string | null | undefined; team?: string | null | undefined; role?: string | null | undefined; badge?: string | null | undefined; bio?: string | null | undefined; actions?: ReactNode; compact?: boolean | undefined;
}) {
  return <section className={`gw-hero-card ${compact ? 'is-compact' : ''}`}>
    <GatheringCover path={cover} title={name ?? ''} className="gw-hero-cover profile-photo-cover" />
    <div className="gw-hero-body">
      <div className="gw-hero-avatar">{avatar}</div>
      {actions && <div className="gw-hero-actions">{actions}</div>}
      <h2 className="gw-hero-name">{name}</h2>
      {(city || team) && <p className="gw-hero-sub">{[city, team].filter(Boolean).join(' · ')}</p>}
      {(role || badge) && <div className="profile-chips">{role && <span className="chip">{role}</span>}{badge && <span className="chip warm-chip">{badge}</span>}</div>}
      {bio && <p className="gw-hero-bio">{bio}</p>}
    </div>
  </section>;
}

export function StatsStrip({ userId, teamId }: { userId: string; teamId?: string | null | undefined }) {
  const { t, i18n } = useTranslation();
  const { data } = useQuery(profileStatsQuery(userId, teamId));
  const fmt = new Intl.NumberFormat(i18n.resolvedLanguage);
  const items = [['hosted', 'statHosted'], ['attended', 'statAttended'], ['streak', 'statStreak'], ['badges', 'statBadges']] as const;
  return <div className="gw-stats-strip" role="list">
    {items.map(([k, label]) => <div role="listitem" key={k} className="gw-stat"><strong>{data ? fmt.format(data[k]) : <span className="gw-stat-skel" aria-hidden="true" />}</strong><span>{t(`profile.${label}`)}</span></div>)}
  </div>;
}

export function RecentBadges({ userId, teamId, onAll }: { userId: string; teamId?: string | null | undefined; onAll?: (() => void) | undefined }) {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery(recentBadgesQuery(userId, teamId));
  return <section className="panel gw-recent-badges">
    <div className="section-heading"><h2>{t('profile.recentBadges')}</h2>{onAll && <button type="button" className="gw-text-btn" onClick={onAll}>{t('profile.seeAll')}</button>}</div>
    {data.length ? <div className="gw-badge-row">{data.map(b => <div key={b.id} className={`gw-badge-chip tier-${b.tier}`}><GwFeatureTile name={(b.icon || 'Award') as GwIconName} size={24} /><span>{i18n.resolvedLanguage === 'es' ? b.name_es : b.name_en}</span></div>)}</div>
      : <div className="gw-empty-inline"><GwFeatureTile name="Award" size={24} /><p>{t('profile.badgesEmpty')}</p></div>}
  </section>;
}

/** Grouped inset list with a title. */
export function SettingsGroup({ title, children, danger }: { title?: string; children: ReactNode; danger?: boolean }) {
  return <section className={`gw-group ${danger ? 'is-danger' : ''}`}>{title && <h3 className="gw-group-title">{title}</h3>}<div className="gw-group-list">{children}</div></section>;
}

function EmptyComposed({ icon, title, body }: { icon: GwIconName; title: string; body: string }) {
  return <div className="gw-empty-composed"><GwFeatureTile name={icon} size={28} /><h3>{title}</h3><p>{body}</p></div>;
}

function GatheringRow({ g }: { g: MyGathering }) {
  const { t, i18n } = useTranslation();
  const d = new Date(g.starts_at);
  return <Link to="/event/$id" params={{ id: g.id }} className="gw-list-row">
    <span className="date-tile"><span>{d.toLocaleDateString(i18n.resolvedLanguage, { month: 'short' })}</span><strong>{d.getDate()}</strong></span>
    <span className="gw-list-main"><strong>{g.title}</strong><small>{d.toLocaleTimeString(i18n.resolvedLanguage, { hour: 'numeric', minute: '2-digit' })}{g.location_name ? ` · ${g.location_name}` : ''}</small></span>
    {g.hosting ? <span className="chip">{t('profile.hosting')}</span> : <span className="chip warm-chip">{t('profile.going')}</span>}
  </Link>;
}

export function MyGatheringsList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const q = useQuery(myGatheringsQuery(userId));
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const now = Date.now();
  const up = q.data.filter(g => new Date(g.starts_at).getTime() >= now).reverse();
  const past = q.data.filter(g => new Date(g.starts_at).getTime() < now);
  if (!q.data.length) return <EmptyComposed icon="CalendarDays" title={t('profile.gatheringsEmptyTitle')} body={t('profile.gatheringsEmpty')} />;
  return <div className="gw-list-sections">
    <h3 className="gw-group-title">{t('profile.upcoming')}</h3>
    {up.length ? <div className="gw-group-list">{up.map(g => <GatheringRow key={g.id} g={g} />)}</div> : <p className="gw-muted-line">{t('profile.noUpcoming')}</p>}
    <h3 className="gw-group-title">{t('profile.past')}</h3>
    {past.length ? <div className="gw-group-list">{past.map(g => <GatheringRow key={g.id} g={g} />)}</div> : <p className="gw-muted-line">{t('profile.noPast')}</p>}
  </div>;
}

export function MyChallengesList({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery(myChallengesQuery(userId));
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!q.data.length) return <EmptyComposed icon="Flag" title={t('profile.challengesEmptyTitle')} body={t('profile.challengesEmpty')} />;
  const today = new Date().toISOString().slice(0, 10);
  const fmt = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, { month: 'short', day: 'numeric' });
  const row = (c: (typeof q.data)[number]) => <Link key={c.id} to="/challenge/$id" params={{ id: c.id }} className="gw-list-row">
    <GwFeatureTile name="Flag" size={24} /><span className="gw-list-main"><strong>{i18n.resolvedLanguage === 'es' ? c.title_es : c.title_en}</strong><small>{fmt(c.starts_on)} – {fmt(c.ends_on)}</small></span><GwIcon name="ChevronRight" className="settings-chevron" />
  </Link>;
  const active = q.data.filter(c => c.ends_on >= today), done = q.data.filter(c => c.ends_on < today);
  return <div className="gw-list-sections">
    <h3 className="gw-group-title">{t('profile.activeNow')}</h3>
    {active.length ? <div className="gw-group-list">{active.map(row)}</div> : <p className="gw-muted-line">{t('profile.noActive')}</p>}
    <h3 className="gw-group-title">{t('profile.past')}</h3>
    {done.length ? <div className="gw-group-list">{done.map(row)}</div> : <p className="gw-muted-line">{t('profile.noPast')}</p>}
  </div>;
}
