import { readChatLinks, tgShare } from '@/lib/chat-links';
import { CropFileInput } from '@/components/image-crop';
import { CopyButton } from '@/components/copy-button';
import { trackEvent } from '@/lib/analytics';
import { EmptyState, ListSkeleton } from "@/components/launch-states";
import { ClaimGuard } from '@/components/smart';
import { ReportButton } from '@/components/report-button';
import { takePendingAnnouncement } from '@/lib/assistant-client';
import { useChannelStatus } from '@/components/notifications';
import { ActiveChallengeCard, ChallengesSection } from '@/components/challenges';
import { HostOfMonthCard, Medallion, PinnedShoutout, RecognitionTools, ShoutoutModeration, ShoutoutSheet, useHostOfMonthId } from '@/components/recognition';
import type { Tier } from '@/lib/recognition';
import i18n from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { FromYourLeader, TemplatesSection } from '@/components/templates';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart3, MapPinned } from '@/components/icons';
import {
  ArrowRight, Share2, Pin, Megaphone, ThumbsUp, PartyPopper, Heart, Copy, Check, MessageCircle, Smartphone, QrCode, RefreshCw,
  Pencil, UsersRound, Search, ChevronRight, ChevronLeft, Network, Plus, CalendarDays, List, Upload, Trash2, Printer, Crown, X,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ProfileHero, RecentBadges, StatsStrip } from '@/components/profile-hero';
import { confirmAction } from '@/components/confirm-dialog';
import { useGatherwell } from '@/components/gatherwell-shell';
import { TeamSwitcher, useSwitchTeam } from '@/components/team-switcher';
import { EventRows } from '@/components/gatherwell-pages';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf, joinLink, mediaUrl, uploadMedia, workspaceQuery, type TeamMembership } from '@/lib/account';
import {
  TEAM_COLORS, announcementsQuery, calendarQuery, relativeTime, rosterQuery, teamDetailQuery, teamKey, teamTreeQuery, upcomingQuery, winsQuery,
  type Member, type TeamEvent, type Win,
} from '@/lib/team';

type Sheet = 'invite' | 'edit' | 'members' | 'announce' | 'subteams' | null;

function useSignedUrl(path?: string | null) {
  return useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 }).data ?? null;
}

function errorText(t: (key: string) => string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('last_leader')) return t('teamSpace.lastLeader');
  if (message.includes('not_allowed') || message.includes('not_leader')) return t('teamSpace.notAllowed');
  return t('profile.saveError');
}

function DateTile({ iso, lang }: { iso: string; lang: string }) {
  const d = new Date(iso);
  return <div className="date-tile"><span>{d.toLocaleDateString(lang, { month: 'short' })}</span><strong>{d.getDate()}</strong></div>;
}

function NoTeam() {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  const done = async () => { await queryClient.invalidateQueries({ queryKey: ['teams', userId] }); await queryClient.invalidateQueries({ queryKey: ['workspace', userId] }); };
  return <section className="panel no-team"><h2>{t('teamSpace.noTeamTitle')}</h2><EmptyState compact icon="UsersRound" text={t('teamSpace.noTeamText')} />
    <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; setBusy(true); const { error } = await supabase.rpc('create_team', { _name: name.trim() }); setBusy(false); if (error) toast.error(errorText(t, error)); else await done(); }}>
      <Input className="field-input" placeholder={t('onboarding.teamNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} aria-label={t('onboarding.teamName')} maxLength={80} />
      <Button disabled={busy || !name.trim()}>{t('teamSpace.createTeam')}</Button>
    </form>
    <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (!code.trim()) return; setBusy(true); const { error } = await supabase.rpc('join_team_by_code', { _code: code.trim() }); if (!error) trackEvent('team_joined'); setBusy(false); if (error) toast.error(t('onboarding.invalidCode')); else await done(); }}>
      <Input className="field-input" placeholder={t('onboarding.codePlaceholder')} value={code} onChange={e => setCode(e.target.value)} aria-label={t('onboarding.code')} />
      <Button variant="secondary" disabled={busy || !code.trim()}>{t('teamSpace.joinTeam')}</Button>
    </form>
  </section>;
}

import { DiscussionsPanel, GroupChatLink } from '@/components/conversation';
export function TeamPage() {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data: workspace, isLoading } = useQuery(workspaceQuery(userId));
  if (isLoading) return <ListSkeleton />;
  return <>
    <TeamSwitcher userId={userId} className="mobile-switcher" />
    <div className="page-heading"><div><span className="eyebrow">{t('team.eyebrow')}</span><h1>{t('team.title')}</h1></div></div>
    {workspace ? <TeamSpace key={workspace.teamId} workspace={workspace} /> : <NoTeam />}
  </>;
}

function TeamSpace({ workspace }: { workspace: TeamMembership }) {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell();
  const teamId = workspace.teamId; const isLeader = workspace.role === 'leader';
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data: team } = useQuery(teamDetailQuery(teamId));
  const { data: tree = [] } = useQuery(teamTreeQuery(teamId));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draftBody, setDraftBody] = useState<string | null>(null);
  useEffect(() => { const pending = takePendingAnnouncement(); if (pending) { setDraftBody(pending); if (isLeader) setSheet('announce'); else void navigator.clipboard?.writeText(pending).catch(() => {}); } }, [isLeader]);
  const navigate = useNavigate();
  const switchTeam = useSwitchTeam(userId);
  const setOpenEvent = (event: TeamEvent) => { void navigate({ to: '/event/$id', params: { id: event.id } }); };
  const { data: parent } = useQuery({ queryKey: ['team-parent', team?.parent_team_id], enabled: !!team?.parent_team_id, queryFn: async () => (await supabase.from('teams').select('id, name').eq('id', team!.parent_team_id!).maybeSingle()).data });
  const root = tree.find(node => node.id === teamId);
  const cover = useSignedUrl(team?.cover_url);
  const canCreateSub = isLeader || (workspace.role === 'host' && !!team?.allow_host_subteams);

  return <>
    {parent && <nav className="team-breadcrumb" aria-label={t('teamSpace.breadcrumb')}><button type="button" className="auth-link" onClick={() => switchTeam(parent.id)}><ChevronLeft />{parent.name}</button><span aria-hidden="true">/</span><strong>{workspace.name}</strong></nav>}
    <section className="team-header panel">
      <div className="team-cover" style={cover ? { backgroundImage: `url(${cover})` } : team?.brand_color ? { background: `linear-gradient(135deg, ${team.brand_color}, var(--lavender))` } : undefined}>
        {!cover && <span className="team-cover-initial" aria-hidden="true">{(workspace.name.trim()[0] ?? 'G').toUpperCase()}</span>}
      </div>
      <div className="team-header-body">
        <div><h2 className="team-name">{workspace.name}</h2>
          <div className="team-leader"><span className="initial-avatar">{initialsOf(root?.leader_name)}</span><span>{root?.leader_name ?? t('roles.leader')}</span><span className="dot-sep" aria-hidden="true">·</span><span>{t('teamSpace.memberCount', { count: root?.member_count ?? 0 })}</span></div>
        </div>
        <Button variant="secondary" onClick={() => setSheet('invite')}><Share2 />{t('teamSpace.shareInvite')}</Button>
      </div>
    </section>

    <HostOfMonthCard teamId={teamId} teamName={workspace.name} />
    <PinnedAnnouncement teamId={teamId} />
    <PinnedShoutout teamId={teamId} isLeader={isLeader} />
    <ActiveChallengeCard />
    <GroupChatLink table="teams" id={teamId} links={readChatLinks(team as any)} canEdit={isLeader} />
    <DiscussionsPanel teamId={teamId} isLeader={isLeader} me={userId} />
    <ComingUp teamId={teamId} lang={lang} onOpen={setOpenEvent} />
    <FromYourLeader teamId={teamId} role={workspace.role} />
    <ChallengesSection />

    {isLeader && <section className="panel leader-tools"><div className="section-heading"><h2>{t('teamSpace.leaderTools')}</h2><span className="chip">{t('roles.leader')}</span></div>
      <div className="leader-links">
        <Link to="/team/insights" className="tool-tile"><BarChart3 /><span>{t('insights.title')}</span><ChevronRight className="settings-chevron" /></Link>
        <Link to="/team/map" className="tool-tile"><MapPinned /><span>{t('insights.mapLink')}</span><ChevronRight className="settings-chevron" /></Link>
      </div>
      <div className="tool-grid">
        {([['edit', Pencil, 'editTeam'], ['invite', Share2, 'invite'], ['members', UsersRound, 'members'], ['announce', Megaphone, 'announce'], ['subteams', Network, 'subteams']] as const).map(([key, Icon, label]) =>
          <button type="button" key={key} className="tool-tile" onClick={() => setSheet(key)}><Icon /><span>{t(`teamSpace.${label}`)}</span><ChevronRight className="settings-chevron" /></button>)}
      </div>
      <h3 className="field-label recognition-heading">{t('recognition.title')}</h3>
      <RecognitionTools teamId={teamId} />
    </section>}
    {!isLeader && <section className="panel"><button type="button" className="settings-row" onClick={() => setSheet('members')}><UsersRound className="settings-icon" /><span className="settings-label">{t('teamSpace.members')}</span><ChevronRight className="settings-chevron" /></button></section>}

    {(tree.length > 1 || canCreateSub) && <SubTeams teamId={teamId} canCreate={canCreateSub} isLeader={isLeader} allowHosts={!!team?.allow_host_subteams} />}
    {isLeader && <TemplatesSection teamId={teamId} userId={userId} />}
    <TeamCalendar teamId={teamId} lang={lang} onOpen={setOpenEvent} />
    <WinsFeed teamId={teamId} userId={userId} lang={lang} isLeader={isLeader} />

    <InviteSheet open={sheet === 'invite'} onOpenChange={o => !o && setSheet(null)} workspace={workspace} joinCode={team?.join_code ?? workspace.joinCode} isLeader={isLeader} />
    {isLeader && team && <EditTeamSheet open={sheet === 'edit'} onOpenChange={o => !o && setSheet(null)} team={team} userId={userId} />}
    <MembersSheet open={sheet === 'members'} onOpenChange={o => !o && setSheet(null)} teamId={teamId} userId={userId} isLeader={isLeader} directLeader={isLeader && !workspace.inherited} />
    {isLeader && <AnnounceSheet open={sheet === 'announce'} onOpenChange={o => !o && setSheet(null)} teamId={teamId} userId={userId} initialBody={draftBody} />}
    {isLeader && <ResponsiveSheet open={sheet === 'subteams'} onOpenChange={o => !o && setSheet(null)} title={t('teamSpace.subteams')}><SubTeamSettings teamId={teamId} allowHosts={!!team?.allow_host_subteams} /></ResponsiveSheet>}
  </>;
}

function PinnedAnnouncement({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data = [] } = useQuery(announcementsQuery(teamId));
  const pinned = data.find(a => a.pinned);
  const photo = useSignedUrl(pinned?.photo_url);
  if (!pinned) return null;
  return <section className="panel pinned-card"><span className="eyebrow pinned-label"><Pin />{t('teamSpace.pinned')}</span><p className="pinned-body">{pinned.body}</p>{photo && <img className="announcement-photo" src={photo} alt="" />}</section>;
}

function ComingUp({ teamId, lang, onOpen }: { teamId: string; lang: string; onOpen: (event: TeamEvent) => void }) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useQuery(upcomingQuery(teamId));
  return <section className="panel"><div className="section-heading"><h2>{t('home.upcoming')}</h2><div className="heading-actions">{!isLoading && !data.length && <span className="chip sample-badge">{t('common.sample')}</span>}<Button asChild variant="link"><Link to="/events">{t('home.viewAll')}<ArrowRight /></Link></Button></div></div>
    {isLoading ? <ListSkeleton /> : data.length ? <div className="event-list">{data.map(event => <button type="button" className="event-row event-button" key={event.id} onClick={() => onOpen(event)}>
      <DateTile iso={event.starts_at} lang={lang} />
      <div className="event-info"><h3>{event.title}</h3><p>{new Date(event.starts_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })} · {event.location_name ?? (event.online_url ? t('teamSpace.online') : t('teamSpace.placeTbd'))}</p>
        <div className="event-registration"><span>{event.capacity ? t('sampleEvents.registered', { count: event.going ?? 0, total: event.capacity }) : t('teamSpace.going', { count: event.going ?? 0 })}</span></div>
        {event.capacity ? <progress className="attendance-progress" value={event.going ?? 0} max={event.capacity} /> : null}</div>
      <ChevronRight className="settings-chevron" /></button>)}</div> : <EventRows />}
  </section>;
}

const REACTIONS = [{ kind: 'like', Icon: ThumbsUp }, { kind: 'celebrate', Icon: PartyPopper }, { kind: 'heart', Icon: Heart }] as const;

function winText(t: TFunction, win: Win) {
  const name = win.actorName || (typeof win.payload['guest'] === 'string' && win.payload['guest']) || t('teamSpace.someone');
  const title = String(win.payload['title'] ?? win.payload['name'] ?? '');
  switch (win.type) {
    case 'member_joined': return t('teamSpace.win.member_joined', { name });
    case 'event_published': return t('teamSpace.win.event_published', { name, title });
    case 'checked_in': { const n = Number(win.payload['count'] ?? 1); return n > 1 ? t('teamSpace.win.checked_in_group', { name, title, count: n - 1 }) : t('teamSpace.win.checked_in', { name, title }); }
    case 'milestone': return t('teamSpace.win.milestone', { count: Number(win.payload['members'] ?? 0) });
    case 'announcement_posted': return t('teamSpace.win.announcement_posted', { name });
    case 'team_created': return t('teamSpace.win.team_created', { name, title });
    case 'leader_changed': return t('teamSpace.win.leader_changed', { name });
    case 'template_published': return t('teamSpace.win.template_published', { name, title });
    case 'template_launched': return t('teamSpace.win.template_launched', { name, title });
    case 'shoutout': return `${t('teamSpace.win.shoutout', { name, to: String(win.payload['to_name'] ?? '') })}: “${String(win.payload['body'] ?? '')}”`;
    case 'guest_milestone': return t('teamSpace.win.guest_milestone', { title, count: Number(win.payload['guests'] ?? 0) });
    case 'track_completed': return t('teamSpace.win.track_completed', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title });
    case 'challenge_joined': { const n = Number(win.payload['count'] ?? 1); return n > 1 ? t('teamSpace.win.challenge_joined_group', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title, count: n - 1 }) : t('teamSpace.win.challenge_joined', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title }); }
    case 'challenge_streak': return t('teamSpace.win.challenge_streak', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title });
    case 'challenge_finished': return t('teamSpace.win.challenge_finished', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title, count: Number(win.payload['days'] ?? 0) });
    case 'challenge_cheer': return `${t('teamSpace.win.challenge_cheer', { name, title: (i18n.resolvedLanguage === 'es' && typeof win.payload['title_es'] === 'string' && win.payload['title_es']) || title })}: “${String(win.payload['body'] ?? '')}”`;
    case 'subteam_created': return t('teamSpace.win.subteam_created', { name, title });
    case 'badge_earned': { const badge = (i18n.resolvedLanguage === 'es' && typeof win.payload['name_es'] === 'string' && win.payload['name_es']) || String(win.payload['name_en'] ?? ''); return win.payload['by_name'] ? t('teamSpace.win.badge_awarded', { name, badge, by: String(win.payload['by_name']) }) : t('teamSpace.win.badge_earned', { name, badge }); }
    case 'host_of_month': return t('teamSpace.win.host_of_month', { name, month: new Date(`${String(win.payload['month'] ?? '')}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, { month: 'long' }) });
    default: return t('teamSpace.win.default');
  }
}

function WinPhoto({ path }: { path: string }) {
  const url = useSignedUrl(path);
  return url ? <img className="announcement-photo" src={url} alt="" /> : null;
}

function WinsFeed({ teamId, userId, lang, isLeader }: { teamId: string; userId: string; lang: string; isLeader: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery(winsQuery(teamId, userId));
  const homId = useHostOfMonthId(teamId);
  const [shouting, setShouting] = useState(false);
  const toggle = async (win: Win, kind: 'like' | 'celebrate' | 'heart') => {
    const mine = win.reactions[kind].mine;
    const { error } = mine
      ? await supabase.from('activity_reactions').delete().match({ activity_id: win.id, user_id: userId, kind })
      : await supabase.from('activity_reactions').insert({ activity_id: win.id, user_id: userId, kind });
    if (error) toast.error(errorText(t, error));
    await queryClient.invalidateQueries({ queryKey: [...teamKey(teamId), 'wins'] });
  };
  return <section className="panel" id="wins"><div className="section-heading"><h2>{t('teamSpace.wins')}</h2><div className="heading-actions">{!isLoading && !data.length && <span className="chip sample-badge">{t('common.sample')}</span>}<Button variant="secondary" size="sm" onClick={() => setShouting(true)}><Megaphone />{t('recognition.giveShoutout')}</Button></div></div>
    {isLoading ? <ListSkeleton /> : data.length ? <ol className="wins-list">{data.map(win => <li className="win-item" key={win.id}>
      {win.type === 'badge_earned' ? <Medallion badge={{ icon: String(win.payload['icon'] ?? 'Award'), tier: (['bronze', 'silver', 'gold'].includes(String(win.payload['tier'])) ? win.payload['tier'] : 'bronze') as Tier }} size={40} />
        : <span className={`initial-avatar ${win.actorId && win.actorId === homId ? 'hom-ring' : ''}`}>{win.type === 'milestone' || win.type === 'host_of_month' ? <Crown /> : initialsOf(win.actorName ?? (win.payload['guest'] as string | undefined))}</span>}
      <div className="win-body"><p className="win-text">{winText(t, win)}</p>
        {win.type === 'announcement_posted' && typeof win.payload['body'] === 'string' && <p className="win-quote">{win.payload['body']}</p>}
        {win.type === 'badge_earned' && typeof win.payload['note'] === 'string' && <p className="win-quote">{win.payload['note']}</p>}
        {win.type === 'host_of_month' && typeof win.payload['note'] === 'string' && <p className="win-quote">{win.payload['note']}</p>}
        {win.type === 'shoutout' && typeof win.payload['photo_path'] === 'string' && <WinPhoto path={win.payload['photo_path']} />}
        <div className="win-meta"><time dateTime={win.created_at}>{relativeTime(win.created_at, lang)}</time>
          <div className="reactions">{REACTIONS.map(({ kind, Icon }) => <button type="button" key={kind} className={`reaction ${win.reactions[kind].mine ? 'is-mine' : ''}`} aria-pressed={win.reactions[kind].mine} aria-label={t(`teamSpace.react.${kind}`)} onClick={() => toggle(win, kind)}><Icon />{win.reactions[kind].count > 0 && <span>{win.reactions[kind].count}</span>}</button>)}
            {isLeader && win.type === 'shoutout' && typeof win.payload['shoutout_id'] === 'string' && <ShoutoutModeration teamId={teamId} shoutoutId={win.payload['shoutout_id']} />}
            {win.actorId !== userId && (win.type === 'shoutout' && typeof win.payload['shoutout_id'] === 'string' ? <ReportButton type="shoutout" id={win.payload['shoutout_id']} /> : <ReportButton type="activity" id={win.id} />)}</div>
        </div></div></li>)}</ol>
      : <div className="pulse-list">{(['sofia', 'challenge', 'maria'] as const).map(key => <div className="pulse-item" key={key}><span className="pulse-dot" /><div><h3>{t(`pulse.${key}.title`)}</h3><p>{t(`pulse.${key}.time`)}</p></div></div>)}</div>}
    <ShoutoutSheet open={shouting} onOpenChange={setShouting} teamId={teamId} />
  </section>;
}

function InviteSheet({ open, onOpenChange, workspace, joinCode, isLeader }: { open: boolean; onOpenChange: (o: boolean) => void; workspace: TeamMembership; joinCode: string; isLeader: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false); const [qr, setQr] = useState(false);
  const { userId } = useGatherwell();
  const link = typeof window === 'undefined' ? '' : `${joinLink(joinCode)}?by=${userId}`;
  const message = t('teamSpace.inviteMessage', { team: workspace.name, link });
  useEffect(() => { if (!open) { setCopied(false); } }, [open]);
  const reset = async () => {
    const { error } = await supabase.rpc('reset_join_code', { _team: workspace.teamId });
    if (error) { toast.error(errorText(t, error)); return; }
    toast.success(t('teamSpace.codeReset'));
    await queryClient.invalidateQueries({ queryKey: teamKey(workspace.teamId) });
    await queryClient.invalidateQueries({ queryKey: ['teams'] }); await queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };
  return <>
    <ResponsiveSheet open={open && !qr} onOpenChange={onOpenChange} title={t('teamSpace.invite')} description={t('teamSpace.inviteText', { team: workspace.name })}>
      <div className="copy-field"><span>{link}</span></div>
      <div className="share-grid">
        <CopyButton variant="default" text={link} label={t('onboarding.copy')} />
        <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button><Button asChild variant="secondary"><a href={tgShare(message)} target="_blank" rel="noopener noreferrer"><Send />{t('teamSpace.telegram')}</a></Button>
        <Button asChild variant="secondary"><a href={`sms:?&body=${encodeURIComponent(message)}`}><Smartphone />{t('teamSpace.sms')}</a></Button>
        <Button variant="secondary" onClick={() => setQr(true)}><QrCode />{t('teamSpace.qr')}</Button>
      </div>
      <p className="field-label">{t('onboarding.code')}: <strong className="join-code">{joinCode}</strong></p>
      {isLeader && <Button variant="ghost" className="quiet-action" onClick={async () => { if (await confirmAction({ title: t('teamSpace.resetCode'), body: t('teamSpace.resetConfirm'), destructive: true, confirmLabel: t('teamSpace.resetCode') })) await reset(); }}><RefreshCw />{t('teamSpace.resetCode')}</Button>}
    </ResponsiveSheet>
    <Dialog open={qr} onOpenChange={setQr}>
      <DialogContent className="qr-fullscreen"><DialogTitle className="sr-only">{t('teamSpace.qr')}</DialogTitle><DialogDescription className="sr-only">{link}</DialogDescription>
        <div className="qr-stage"><span className="eyebrow">{t('teamSpace.scanToJoin')}</span><h2 className="qr-team">{workspace.name}</h2>
          <div className="qr-code"><QRCodeSVG value={link} size={320} level="M" marginSize={2} /></div>
          <p className="join-code">{joinCode}</p>
          <div className="confirm-actions no-print"><Button variant="secondary" onClick={() => window.print()}><Printer />{t('teamSpace.print')}</Button><Button variant="secondary" onClick={() => setQr(false)}><X />{t('common.close')}</Button></div>
        </div></DialogContent>
    </Dialog>
  </>;
}

function EditTeamSheet({ open, onOpenChange, team, userId }: { open: boolean; onOpenChange: (o: boolean) => void; team: { id: string; name: string; cover_url: string | null; brand_color: string | null }; userId: string }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const [name, setName] = useState(team.name); const [color, setColor] = useState<string | null>(team.brand_color);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [removeCover, setRemoveCover] = useState(false); const [busy, setBusy] = useState(false);
  const current = useSignedUrl(removeCover ? null : team.cover_url);
  useEffect(() => { if (open) { setName(team.name); setColor(team.brand_color); setFile(null); setPreview(null); setRemoveCover(false); } }, [open, team]);
  const save = async () => {
    if (!name.trim()) return; setBusy(true);
    try {
      let cover_url = team.cover_url;
      if (file) cover_url = await uploadMedia(userId, file, 'cover'); else if (removeCover) cover_url = null;
      const { error } = await supabase.from('teams').update({ name: name.trim(), brand_color: color, cover_url }).eq('id', team.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: teamKey(team.id) });
      await queryClient.invalidateQueries({ queryKey: ['teams'] }); await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success(t('teamSpace.teamSaved')); onOpenChange(false);
    } catch (error) { toast.error(errorText(t, error)); }
    setBusy(false);
  };
  const shown = preview ?? current;
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('teamSpace.editTeam')} footer={<Button className="sheet-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>}>
    <div className="edit-form">
      <div className="form-field"><label className="field-label" htmlFor="team-name">{t('onboarding.teamName')}</label><Input id="team-name" className="field-input" value={name} maxLength={80} onChange={e => setName(e.target.value)} /></div>
      <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
        <div className="cover-edit" style={shown ? { backgroundImage: `url(${shown})` } : color ? { background: `linear-gradient(135deg, ${color}, var(--lavender))` } : undefined}>{!shown && <span className="team-cover-initial">{(name.trim()[0] ?? 'G').toUpperCase()}</span>}</div>
        <div className="photo-row"><label className="file-button"><Upload />{t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={r => { setFile(r.file); setPreview(r.previewUrl); setRemoveCover(false); }} /></label>
          {shown && <button type="button" className="auth-link" onClick={() => { setFile(null); setPreview(null); setRemoveCover(true); }}>{t('onboarding.removePhoto')}</button>}</div></div>
      <div className="form-field"><span className="field-label">{t('teamSpace.brandColor')}</span>
        <div className="swatches">{TEAM_COLORS.map(value => <button type="button" key={value} className={`swatch ${color === value ? 'is-selected' : ''}`} style={{ background: value }} aria-label={value} aria-pressed={color === value} onClick={() => setColor(value)}>{color === value && <Check />}</button>)}
          <label className={`swatch swatch-custom ${color && !TEAM_COLORS.includes(color as typeof TEAM_COLORS[number]) ? 'is-selected' : ''}`} style={color && !TEAM_COLORS.includes(color as typeof TEAM_COLORS[number]) ? { background: color } : undefined} aria-label={t('teamSpace.customColor')}><Plus /><input type="color" className="sr-only" value={color ?? '#2F2340'} onChange={e => setColor(e.target.value.toUpperCase())} /></label></div></div>
    </div>
  </ResponsiveSheet>;
}

function MembersSheet({ open, onOpenChange, teamId, userId, isLeader, directLeader }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string; userId: string; isLeader: boolean; directLeader: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data: roster = [] } = useQuery({ ...rosterQuery(teamId), enabled: open });
  const homId = useHostOfMonthId(teamId);
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState<Member | null>(null);
  const [badge, setBadge] = useState(''); const [confirm, setConfirm] = useState<'remove' | 'transfer' | null>(null);
  const filtered = roster.filter(m => (m.name ?? '').toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => { setBadge(selected?.customBadge ?? ''); setConfirm(null); }, [selected]);
  useEffect(() => { if (!open) setSelected(null); }, [open]);
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); await queryClient.invalidateQueries({ queryKey: ['teams'] }); await queryClient.invalidateQueries({ queryKey: ['workspace'] }); };
  const run = async (action: () => PromiseLike<{ error: unknown }>, success: string, close = true) => {
    const { error } = await action();
    if (error) { toast.error(errorText(t, error)); return; }
    toast.success(success); await refresh(); if (close) setSelected(null);
  };
  const update = (patch: { role?: string; custom_badge?: string | null }) => run(() => supabase.from('team_members').update(patch).match({ team_id: teamId, user_id: selected!.userId }), t('teamSpace.memberSaved'), false).then(() => setSelected(s => s ? { ...s, role: patch.role ?? s.role, customBadge: patch.custom_badge !== undefined ? patch.custom_badge : s.customBadge } : s));

  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={selected ? (selected.name ?? t('teamSpace.someone')) : t('teamSpace.members')} icon="UsersRound">
    {!selected ? <>
      <div className="search-field"><Search /><Input className="field-input" placeholder={t('teamSpace.searchMembers')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('teamSpace.searchMembers')} /></div>
      <div className="member-list">{filtered.map(m => <button type="button" key={m.userId} className="member-row" onClick={() => setSelected(m)}>
        <span className={`initial-avatar ${m.userId === homId ? 'hom-ring' : ''}`}>{initialsOf(m.name)}</span><span className="member-name">{m.name ?? t('teamSpace.someone')}{m.userId === userId && <small> · {t('common.you')}</small>}</span>
        {m.customBadge && <span className="chip warm-chip">{m.customBadge}</span>}<span className="chip">{t(`roles.${m.role}`)}</span><ChevronRight className="settings-chevron" /></button>)}
        {!filtered.length && <EmptyState compact icon="UsersRound" text={t('teamSpace.noMatches')} />}</div>
    </> : <div className="edit-form">
      <button type="button" className="auth-link back-link" onClick={() => setSelected(null)}><ChevronLeft />{t('common.back')}</button>
      <ProfileHero compact avatar={<span className={`initial-avatar profile-avatar ${selected.userId === homId ? 'hom-ring' : ''}`} style={{ width: 88, height: 88, fontSize: 28 }}>{initialsOf(selected.name)}</span>}
        name={selected.name ?? t('teamSpace.someone')} role={t(`roles.${selected.role}`)} badge={selected.customBadge}
        team={t('profile.memberSince', { date: new Date(selected.joinedAt).toLocaleDateString(i18n.resolvedLanguage, { month: 'short', year: 'numeric' }) })} />
      <StatsStrip userId={selected.userId} teamId={teamId} />
      <RecentBadges userId={selected.userId} teamId={teamId} />
      {isLeader && <section className="gw-manage"><h3 className="gw-group-title">{t('profile.manage')}</h3>
      {selected.role !== 'leader' && <div className="form-field"><span className="field-label">{t('teamSpace.role')}</span>
        <div className="choice-pair">{(['host', 'member'] as const).map(role => <button type="button" key={role} className={`choice-card ${selected.role === role ? 'is-selected' : ''}`} aria-pressed={selected.role === role} onClick={() => update({ role })}><strong>{t(`roles.${role}`)}</strong></button>)}</div></div>}
      <div className="form-field"><label className="field-label" htmlFor="member-badge">{t('teamSpace.badge')}</label>
        <div className="inline-form"><Input id="member-badge" className="field-input" maxLength={24} placeholder={t('teamSpace.badgePlaceholder')} value={badge} onChange={e => setBadge(e.target.value)} /><Button variant="secondary" onClick={() => update({ custom_badge: badge.trim() || null })}>{t('profile.save')}</Button></div></div>
      {selected.role !== 'leader' && <Button variant="secondary" onClick={() => update({ role: 'leader' })}><Crown />{t('teamSpace.makeLeader')}</Button>}
      {selected.role === 'leader' && selected.userId !== userId && <Button variant="secondary" onClick={() => update({ role: 'host' })}>{t('teamSpace.makeHost')}</Button>}
      {directLeader && selected.userId !== userId && <Button variant="secondary" onClick={async () => { if (await confirmAction({ title: t('teamSpace.transfer'), body: t('teamSpace.transferConfirm', { name: selected.name ?? t('teamSpace.someone') }), confirmLabel: t('teamSpace.transfer') })) void run(() => supabase.rpc('transfer_leadership', { _team: teamId, _to: selected.userId }), t('teamSpace.transferred')); }}>{t('teamSpace.transfer')}</Button>}
      {selected.userId !== userId && <button type="button" className="delete-account" onClick={async () => { if (await confirmAction({ title: t('teamSpace.remove'), body: t('teamSpace.removeConfirm', { name: selected.name ?? t('teamSpace.someone') }), destructive: true, confirmLabel: t('teamSpace.remove') })) void run(() => supabase.from('team_members').delete().match({ team_id: teamId, user_id: selected.userId }), t('teamSpace.removed')); }}><Trash2 className="inline-icon" />{t('teamSpace.remove')}</button>}
      </section>}
    </div>}
  </ResponsiveSheet>;
}

function AnnounceSheet({ open, onOpenChange, teamId, userId, initialBody }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string; userId: string; initialBody?: string | null }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data: list = [] } = useQuery(announcementsQuery(teamId));
  const [body, setBody] = useState(initialBody ?? ''); useEffect(() => { if (initialBody) setBody(initialBody); }, [initialBody]); const [pin, setPin] = useState(true); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [emailTeam, setEmailTeam] = useState(false); const [subteams, setSubteams] = useState(false);
  const { data: channels } = useChannelStatus();
  const refresh = () => queryClient.invalidateQueries({ queryKey: teamKey(teamId) });
  const post = async () => {
    if (!body.trim()) return; setBusy(true);
    try {
      const photo_url = file ? await uploadMedia(userId, file, 'announcement') : null;
      const { data: created, error } = await supabase.from('announcements').insert({ team_id: teamId, author_id: userId, body: body.trim(), photo_url, pinned: pin }).select('id').single();
      if (error) throw error;
      const { data: emailed } = await supabase.rpc('notify_announcement', { _announcement: created.id, _email: emailTeam, _subteams: emailTeam && subteams });
      setBody(''); setFile(null); toast.success(emailTeam ? t('notify.announceQueued', { count: emailed ?? 0 }) : t('teamSpace.posted')); await refresh();
    } catch (error) { toast.error(errorText(t, error)); }
    setBusy(false);
  };
  const act = async (fn: () => PromiseLike<{ error: unknown }>) => { const { error } = await fn(); if (error) toast.error(errorText(t, error)); await refresh(); };
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('teamSpace.announce')}>
    <div className="edit-form">
      <div className="form-field"><div className="label-row"><label className="field-label" htmlFor="announce-body">{t('teamSpace.message')}</label><span className="char-count">{body.length}/2000</span></div>
        <Textarea id="announce-body" rows={4} className="field-textarea" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder={t('teamSpace.messagePlaceholder')} /><ClaimGuard text={body} onUse={setBody} /></div>
      <div className="photo-row"><label className="file-button"><Upload />{file ? file.name : t('teamSpace.addPhoto')}<input type="file" accept="image/*" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>{file && <button type="button" className="auth-link" onClick={() => setFile(null)}>{t('onboarding.removePhoto')}</button>}</div>
      <label className="switch-row"><Switch checked={pin} onCheckedChange={setPin} /><span>{t('teamSpace.pinThis')}</span></label>
      <Button className="onboarding-continue" disabled={busy || !body.trim()} onClick={post}><Megaphone />{busy ? t('onboarding.saving') : t('teamSpace.post')}</Button>
      <label className="switch-row"><Switch checked={emailTeam} onCheckedChange={setEmailTeam} /><span><strong>{t('notify.emailTeam')}</strong>{channels && !channels.announcements && <small className="not-connected-badge">{t('common.notConnected')}</small>}</span></label>
      {emailTeam && <label className="switch-row"><Switch checked={subteams} onCheckedChange={setSubteams} /><span>{t('notify.includeSubteams')}</span></label>}
      <p className="not-connected">{t('notify.announceNote')}</p>
      {list.length > 0 && <div className="announcement-list"><span className="field-label">{t('teamSpace.recent')}</span>{list.map(a => <div className="announcement-row" key={a.id}>
        <p>{a.body}</p><div className="confirm-actions">
          <Button size="sm" variant="secondary" onClick={() => act(() => supabase.from('announcements').update({ pinned: !a.pinned }).eq('id', a.id))}><Pin />{a.pinned ? t('teamSpace.unpin') : t('teamSpace.pin')}</Button>
          <Button size="sm" variant="ghost" aria-label={t('teamSpace.delete')} onClick={() => act(() => supabase.from('announcements').delete().eq('id', a.id))}><Trash2 /></Button></div></div>)}</div>}
    </div>
  </ResponsiveSheet>;
}

function SubTeamSettings({ teamId, allowHosts }: { teamId: string; allowHosts: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  return <label className="switch-row"><Switch checked={allowHosts} onCheckedChange={async value => {
    const { error } = await supabase.from('teams').update({ allow_host_subteams: value }).eq('id', teamId);
    if (error) toast.error(errorText(t, error)); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) });
  }} /><span><strong>{t('teamSpace.allowHosts')}</strong><small>{t('teamSpace.allowHostsText')}</small></span></label>;
}

function SubTeams({ teamId, canCreate, isLeader, allowHosts }: { teamId: string; canCreate: boolean; isLeader: boolean; allowHosts: boolean }) {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const switchTeam = useSwitchTeam(userId);
  const { data: tree = [] } = useQuery(teamTreeQuery(teamId));
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false);
  const children = tree.filter(node => node.depth > 0);
  const create = async () => {
    setBusy(true); const { data, error } = await supabase.rpc('create_subteam', { _parent: teamId, _name: name.trim() }); setBusy(false);
    if (error) { toast.error(errorText(t, error)); return; }
    setName(''); setCreating(false); toast.success(t('teamSpace.subteamCreated'));
    await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); await queryClient.invalidateQueries({ queryKey: ['teams', userId] });
    if (!isLeader && data) await switchTeam(data);
  };
  return <section className="panel"><div className="section-heading"><h2>{t('teamSpace.subteams')}</h2>{canCreate && !creating && <Button variant="secondary" size="sm" onClick={() => setCreating(true)}><Plus />{t('teamSpace.newSubteam')}</Button>}</div>
    {creating && <div className="inline-form"><Input autoFocus className="field-input" maxLength={80} placeholder={t('teamSpace.subteamName')} aria-label={t('teamSpace.subteamName')} value={name} onChange={e => setName(e.target.value)} /><Button disabled={busy || !name.trim()} onClick={create}>{t('common.create')}</Button><Button variant="ghost" onClick={() => setCreating(false)}>{t('common.close')}</Button></div>}
    {children.length ? <ul className="team-tree">{children.map((node, index) => <li key={node.id} style={{ paddingInlineStart: (node.depth - 1) * 24 }}>
      <button type="button" className="tree-row" onClick={() => switchTeam(node.id)}><span className="tree-swatch" style={{ background: `var(--team-${(index % 6) + 1})` }} /><span className="tree-info"><strong>{node.name}</strong><small>{node.leader_name ?? t('roles.leader')} · {t('teamSpace.memberCount', { count: node.member_count })} · {t('teamSpace.eventsThisMonth', { count: node.events_this_month })}</small></span><ChevronRight className="settings-chevron" /></button></li>)}</ul>
      : <p className="auth-subtitle">{isLeader ? (allowHosts ? t('teamSpace.noSubteamsHosts') : t('teamSpace.noSubteams')) : t('teamSpace.noSubteamsHost')}</p>}
  </section>;
}

function TeamCalendar({ teamId, lang, onOpen }: { teamId: string; lang: string; onOpen: (event: TeamEvent) => void }) {
  const { t } = useTranslation();
  const { data: tree = [] } = useQuery(teamTreeQuery(teamId));
  const ids = tree.map(node => node.id);
  const { data: events = [] } = useQuery(calendarQuery(teamId, ids));
  const [view, setView] = useState<'month' | 'list'>('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const colorOf = useMemo(() => { const map = new Map<string, string>(); tree.forEach((node, i) => map.set(node.id, i === 0 ? 'var(--primary)' : `var(--team-${((i - 1) % 6) + 1})`)); return map; }, [tree]);
  const days = useMemo(() => {
    const first = new Date(cursor); const offset = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const upcoming = events.filter(e => new Date(e.starts_at) >= new Date(new Date().toDateString()));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'narrow' }));
  return <section className="panel"><div className="section-heading"><h2>{t('teamSpace.calendar')}</h2>
    <div className="segmented" role="group" aria-label={t('teamSpace.calendar')}>
      <Button variant="ghost" size="icon" className={view === 'month' ? 'selected' : ''} aria-pressed={view === 'month'} aria-label={t('teamSpace.monthView')} onClick={() => setView('month')}><CalendarDays /></Button>
      <Button variant="ghost" size="icon" className={view === 'list' ? 'selected' : ''} aria-pressed={view === 'list'} aria-label={t('teamSpace.listView')} onClick={() => setView('list')}><List /></Button></div></div>
    {tree.length > 1 && <div className="legend">{tree.map(node => <span key={node.id} className="legend-item"><span className="tree-swatch" style={{ background: colorOf.get(node.id) }} />{node.name}</span>)}</div>}
    {view === 'month' ? <>
      <div className="month-nav"><Button variant="ghost" size="icon" aria-label={t('teamSpace.prevMonth')} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft /></Button>
        <strong>{cursor.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</strong>
        <Button variant="ghost" size="icon" aria-label={t('teamSpace.nextMonth')} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight /></Button></div>
      <div className="month-grid">{weekdays.map((w, i) => <span key={i} className="weekday">{w}</span>)}
        {days.map(day => { const list = events.filter(e => sameDay(new Date(e.starts_at), day)); return <div key={day.toISOString()} className={`day-cell ${day.getMonth() !== cursor.getMonth() ? 'is-outside' : ''} ${sameDay(day, new Date()) ? 'is-today' : ''}`}>
          <span className="day-number">{day.getDate()}</span>
          {list.slice(0, 3).map(e => <button type="button" key={e.id} className="day-event" style={{ borderInlineStartColor: colorOf.get(e.team_id) }} onClick={() => onOpen(e)}>{e.title}</button>)}
          {list.length > 3 && <span className="day-more">+{list.length - 3}</span>}</div>; })}</div>
    </> : upcoming.length ? <div className="event-list">{upcoming.slice(0, 20).map(e => <button type="button" key={e.id} className="event-row event-button" onClick={() => onOpen(e)}>
      <DateTile iso={e.starts_at} lang={lang} /><div className="event-info"><h3>{e.title}</h3><p><span className="tree-swatch" style={{ background: colorOf.get(e.team_id) }} />{tree.find(n => n.id === e.team_id)?.name} · {new Date(e.starts_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</p></div><ChevronRight className="settings-chevron" /></button>)}</div>
      : <EmptyState compact icon="UsersRound" text={t('teamSpace.noEvents')} />}
  </section>;
}

