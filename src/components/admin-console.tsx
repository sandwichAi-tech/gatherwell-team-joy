import { useState, type ReactNode } from 'react';
import { ListSkeleton } from '@/components/launch-states';
import { AdminSafety } from '@/components/admin-safety';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { confirmAction } from '@/components/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FoundingAdmin } from '@/components/founding';
import { Day60Admin } from '@/components/day60';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GwFeatureTile, GwIcon, type GwIconProps } from '@/components/gw-icon';
import { formatMoney, planSettingsQuery, type PlanSetting } from '@/lib/billing';
import { updatePlanSettings,
  adminTeamAction, adminUserAction, endBroadcast, getAdminAccess, getAdminOverview, getAdminTeam, getAdminUser, getAudit, getBroadcasts, getFlags, getLibrary,
  listAdminTeams, listAdminUsers, listReports, moderateReport, reorderLibrary, saveLibraryItem, sendBroadcast, setFlag, setLibraryPublished, type AdminReport, listRecentTexts, simulateSmsReply, listMail, retryMail, listVerifications, decideVerification, type AdminVerification,
  listAdminTickets, replyAdminTicket, closeAdminTicket, type AdminTicket,
} from '@/lib/admin.functions';

export const ADMIN_TABS = ['overview', 'teams', 'users', 'offerings', 'moderation', 'communities', 'verify', 'library', 'broadcasts', 'founding', 'day60', 'settings', 'flags', 'audit', 'mail', 'support'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
const TAB_ICONS: Record<AdminTab, GwIconProps['name']> = { overview: 'BarChart3', teams: 'UsersRound', users: 'UserRound', offerings: 'BookOpen', communities: 'ShieldCheck', moderation: 'Flag', verify: 'BadgeCheck', library: 'BookOpen', broadcasts: 'Megaphone', founding: 'Medal', day60: 'Trophy', settings: 'Settings2', flags: 'Settings2', audit: 'FileText', mail: 'Mail', support: 'LifeBuoy' };

const useLang = () => { const { i18n } = useTranslation(); return i18n.resolvedLanguage === 'es' ? 'es' : 'en'; };
const fmtDate = (iso: string | null | undefined, lang: string, time = false) => iso ? new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', time ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '—';
const num = (n: number | undefined, lang: string) => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US').format(n ?? 0);
const errText = (t: (k: string) => string, e: string | undefined) => t(`admin.errors.${e ?? 'failed'}`);

export function AdminConsole({ tab }: { tab: AdminTab }) {
  const { t } = useTranslation(); const navigate = useNavigate();
  const access = useServerFn(getAdminAccess);
  const { data, isLoading } = useQuery({ queryKey: ['admin-access'], queryFn: () => access() });
  if (isLoading) return <ListSkeleton />;
  if (!data?.admin) return <section className="panel empty-panel admin-denied"><GwFeatureTile name="Lock" /><h1 className="section-title">{t('admin.deniedTitle')}</h1><p className="muted-copy">{t('admin.deniedBody')}</p><Button asChild variant="secondary"><Link to="/home">{t('admin.backHome')}</Link></Button></section>;
  return <div className="admin-console">
    <header className="page-heading"><div><p className="eyebrow">{t('admin.eyebrow')}</p><h1>{t('admin.title')}</h1><p>{t('admin.subtitle')}</p></div></header>
    <nav className="admin-tabs" aria-label={t('admin.title')}>{ADMIN_TABS.map(k => <button key={k} type="button" className={tab === k ? 'is-active' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => void navigate({ to: '/admin', search: { tab: k } })}><GwIcon name={TAB_ICONS[k]} size={18} /><span>{t(`admin.tabs.${k}`)}</span></button>)}</nav>
    {tab === 'overview' && <Overview />}
    {tab === 'teams' && <AdminSafety key={tab} kind="teams" />}
    {tab === 'users' && <AdminSafety key={tab} kind="users" />}
    {tab === 'offerings' && <AdminSafety key={tab} kind="offerings" />}
    {tab === 'moderation' && <AdminSafety key={tab} kind="reports" />}
    {tab === 'communities' && <AdminSafety key={tab} kind="communities" />}
    {tab === 'verify' && <Verifications />}
    {tab === 'library' && <Library />}
    {tab === 'broadcasts' && <Broadcasts />}
    {tab === 'founding' && <FoundingAdmin />}
    {tab === 'day60' && <Day60Admin />}
    {tab === 'settings' && <Settings />}
    {tab === 'flags' && <FlagsPanel />}
    {tab === 'audit' && <AdminSafety key={tab} kind="audit" />}
    {tab === 'mail' && <MailLog />}
    {tab === 'support' && <SupportTickets />}
  </div>;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: (v: T) => string }) {
  return <div className="segmented-tabs" role="tablist">{options.map(o => <button key={o} type="button" role="tab" aria-selected={value === o} className={value === o ? 'is-active' : ''} onClick={() => onChange(o)}>{label(o)}</button>)}</div>;
}

function Stat({ icon, label, value, sub }: { icon: GwIconProps['name']; label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="stat-card admin-stat"><div className="stat-top"><span className="stat-icon"><GwIcon name={icon} /></span><span className="stat-label">{label}</span></div><strong className="stat-value tabular-nums">{value}</strong>{sub && <span className="stat-sub">{sub}</span>}</div>;
}

function MiniChart({ points, label }: { points: number[]; label: string }) {
  const max = Math.max(1, ...points); const w = 300; const h = 96;
  const xy = points.map((p, i) => `${(i / Math.max(1, points.length - 1)) * w},${h - (p / max) * (h - 8) - 4}`).join(' ');
  return <svg className="admin-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
    {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} className="chart-grid" />)}
    <polyline points={xy} className="chart-line" fill="none" />
  </svg>;
}

function Overview() {
  const { t } = useTranslation(); const lang = useLang();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const fn = useServerFn(getAdminOverview);
  const qc = useQueryClient();
  const ov = useQuery({ queryKey: ['admin', 'overview', period], staleTime: 0, queryFn: () => fn({ data: { period } }) }); const o = ov.data;
  const channels = ['email', 'sms', 'push'] as const; const states = ['queued', 'sent', 'simulated', 'failed', 'skipped'] as const;
  return <>
    <Segmented value={period} options={['week', 'month', 'all'] as const} onChange={setPeriod} label={v => t(`admin.period.${v}`)} />
    <div className="feed-actions admin-refresh" aria-live="polite">
      {ov.dataUpdatedAt > 0 && <small className="field-hint">{t('admin.updatedAt', { time: new Date(ov.dataUpdatedAt).toLocaleTimeString(lang === 'es' ? 'es-419' : 'en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) })}</small>}
      <Button variant="secondary" disabled={ov.isFetching} onClick={() => void qc.invalidateQueries({ queryKey: ['admin'] })}><GwIcon name="RefreshCw" size={18} />{t(ov.isFetching ? 'admin.refreshing' : 'admin.refresh')}</Button>
    </div>
    {ov.isError ? <><p role="alert" className="field-error">{t('admin.loadError')}</p><Button variant="secondary" onClick={() => void ov.refetch()}>{t('admin.refresh')}</Button></> : !o ? <p className="muted-copy">{t('admin.loading')}</p> : <>
      <div className="admin-stats">
        <Stat icon="UserPlus" label={t('admin.stats.signups')} value={num(o.signups, lang)} />
        <Stat icon="UsersRound" label={t('admin.stats.activeTeams')} value={num(o.active_teams, lang)} />
        <Stat icon="Clock" label={t('quickStart.ttlLabel')} value={o.time_to_live?.median_minutes != null ? t('quickStart.ttlValue', { minutes: num(o.time_to_live.median_minutes, lang) }) : '—'} sub={t('quickStart.ttlSub', { live: o.time_to_live?.live ?? 0, hour: o.time_to_live?.within_hour ?? 0 })} />
        <Stat icon="CalendarPlus" label={t('admin.stats.gatherings')} value={num(o.gatherings, lang)} />
        <Stat icon="CalendarCheck" label={t('admin.stats.rsvps')} value={num(o.rsvps, lang)} />
        <Stat icon="ScanLine" label={t('admin.stats.checkins')} value={num(o.checkins, lang)} />
        <Stat icon="MessageSquareText" label={t('admin.stats.assistant')} value={num(o.ai_requests, lang)} sub={t('admin.stats.aiCost', { cost: formatMoney(o.ai_cost_cents, lang) })} />
        <Stat icon="CreditCard" label={t('admin.stats.mrr')} value={o.mrr_cents == null ? '—' : formatMoney(o.mrr_cents, lang)} sub={o.stripe_connected ? t('admin.stats.mrrNote') : t('admin.notConnected')} />
        <Stat icon="Layers" label={t('admin.stats.plans')} value={num(o.plans.free + o.plans.growth + o.plans.pro + o.plans.team, lang)} sub={(['free', 'growth', 'pro', 'team'] as const).map(k => `${t(`admin.plan.${k}`)} ${o.plans[k]}`).join(' · ')} />
      </div>
      <div className="admin-two">
        <section className="panel"><h2 className="section-title">{t('admin.charts.signups')}</h2><MiniChart points={o.weeks.map(w => w.signups)} label={t('admin.charts.signups')} /><p className="muted-copy">{t('admin.charts.weeks')}</p></section>
        <section className="panel"><h2 className="section-title">{t('admin.charts.checkins')}</h2><MiniChart points={o.weeks.map(w => w.checkins)} label={t('admin.charts.checkins')} /><p className="muted-copy">{t('admin.charts.weeks')}</p></section>
      </div>
      <section className="panel"><h2 className="section-title">{t('admin.messages.title')}</h2>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('admin.messages.channel')}</th>{states.map(s => <th key={s}>{t(`admin.messages.${s}`)}</th>)}</tr></thead>
          <tbody>{channels.map(c => <tr key={c}><th>{t(`admin.messages.${c}`)}</th>{states.map(s => <td key={s} className="tabular-nums">{num(o.messages[`${c}:${s}`], lang)}</td>)}</tr>)}</tbody></table></div>
      </section>
      <TextMonitor />
    </>}
  </>;
}

function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <label className="admin-search"><GwIcon name="Search" size={18} /><Input value={value} onChange={e => onChange(e.target.value)} placeholder={label} aria-label={label} className="field-input" maxLength={100} /></label>;
}

function NoteField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <div className="form-field"><label className="field-label">{label}</label><Textarea rows={2} maxLength={500} className="field-textarea" value={value} onChange={e => onChange(e.target.value)} /></div>;
}

function Teams() {
  const { t } = useTranslation(); const lang = useLang();
  const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const fn = useServerFn(listAdminTeams);
  const { data = [] } = useQuery({ queryKey: ['admin', 'teams', q], queryFn: () => fn({ data: { q } }) });
  return <section className="panel">
    <Search value={q} onChange={setQ} label={t('admin.teams.search')} />
    <ul className="admin-list">{data.map(r => <li key={r.id}><button type="button" className="admin-row" onClick={() => setOpen(r.id)}>
      <span className="admin-row-main"><strong>{r.name}{r.parent_team_id && <small className="chip">{t('admin.teams.subteam')}</small>}</strong><small>{t('admin.teams.leader')}: {r.leader_name ?? '—'} · {t('admin.teams.members', { count: r.members })} · {t('admin.teams.subteams', { count: r.subteams })}</small></span>
      <span className="admin-row-side"><span className="chip">{r.licensed ? t('admin.plan.team') : t(`admin.plan.${r.plan}`)}</span>{r.suspended && <span className="chip danger-chip">{t('admin.suspended')}</span>}<small>{t('admin.teams.last')}: {fmtDate(r.last_activity, lang)}</small></span>
      <GwIcon name="ChevronRight" size={18} /></button></li>)}
      {!data.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
    {open && <TeamSheet id={open} onClose={() => setOpen(null)} />}
  </section>;
}

function TeamSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const fn = useServerFn(getAdminTeam); const act = useServerFn(adminTeamAction);
  const { data } = useQuery({ queryKey: ['admin', 'team', id], queryFn: () => fn({ data: { id } }) });
  const [plan, setPlan] = useState<'free' | 'growth' | 'pro'>('growth'); const [until, setUntil] = useState(''); const [tier, setTier] = useState<'team25' | 'team100'>('team25');
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (action: 'plan' | 'extend' | 'license' | 'suspend' | 'restore') => {
    if (action === 'suspend' && !(await confirmAction({ title: t('admin.teams.suspend'), body: note, destructive: true, confirmLabel: t('admin.teams.suspend') }))) return;
    setBusy(true);
    try {
      const r = await act({ data: { teamId: id, action, plan, until: until || undefined, tier, reason: note || undefined } });
      if (!r.ok) toast.error(errText(t, r.error)); else { toast.success(t('admin.saved')); setNote(''); await qc.invalidateQueries({ queryKey: ['admin'] }); }
    } catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  const team = data?.team;
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={team?.name ?? t('admin.loading')} description={team ? `${t('admin.teams.leader')}: ${team.leader_name ?? '—'}` : ''}>
    {team && <div className="edit-form admin-detail">
      <div className="profile-chips"><span className="chip">{t(`admin.plan.${team.plan.source === 'license' ? 'team' : team.plan.plan}`)}</span>{team.billing?.status === 'trialing' && <span className="chip">{t('admin.teams.freeUntil', { date: fmtDate(team.billing.renews_at, lang) })}</span>}{team.license && <span className="chip">{t('admin.teams.license', { tier: team.license.tier, seats: team.license.seats })}{team.license.is_preview ? ` · ${t('admin.preview')}` : ''}</span>}{team.suspension && <span className="chip danger-chip">{t('admin.suspended')}: {team.suspension.reason}</span>}</div>
      <section><h3 className="admin-sub">{t('admin.teams.membersTitle')}</h3><ul className="admin-mini">{data.members.map(m => <li key={m.user_id}>{m.name ?? '—'} <small>{t(`roles.${m.role}`, { defaultValue: m.role })}</small></li>)}</ul></section>
      <section><h3 className="admin-sub">{t('admin.teams.gatherings')}</h3><ul className="admin-mini">{data.gatherings.length ? data.gatherings.map(g => <li key={g.id}>{g.title} <small>{fmtDate(g.starts_at, lang)} · {t(`teamSpace.status.${g.status}`)}</small></li>) : <li className="muted-copy">{t('admin.empty')}</li>}</ul></section>
      <section><h3 className="admin-sub">{t('admin.teams.templates')}</h3><ul className="admin-mini">{data.templates.length ? data.templates.map(x => <li key={x.id}>{x.title} <small>{t('admin.teams.launches', { count: x.launches_count })}</small></li>) : <li className="muted-copy">{t('admin.empty')}</li>}</ul></section>
      <section><h3 className="admin-sub">{t('admin.teams.activity')}</h3><ul className="admin-mini">{data.activity.length ? data.activity.map((a, i) => <li key={i}>{t(`admin.activity.${a.type}`, { defaultValue: a.type })} <small>{fmtDate(a.created_at, lang, true)}</small></li>) : <li className="muted-copy">{t('admin.empty')}</li>}</ul></section>
      <section className="admin-actions"><h3 className="admin-sub">{t('admin.actions')}</h3>
        <div className="admin-action-row"><label className="field-label" htmlFor="adm-plan">{t('admin.teams.plan')}</label><select id="adm-plan" className="field-input" value={plan} onChange={e => setPlan(e.target.value as typeof plan)}>{(['free', 'growth', 'pro'] as const).map(p => <option key={p} value={p}>{t(`admin.plan.${p}`)}</option>)}</select><Button variant="secondary" disabled={busy} onClick={() => run('plan')}>{t('admin.teams.changePlan')}</Button></div>
        <div className="admin-action-row"><label className="field-label" htmlFor="adm-until">{t('admin.teams.extendUntil')}</label><Input id="adm-until" type="date" className="field-input" value={until} onChange={e => setUntil(e.target.value)} /><Button variant="secondary" disabled={busy || !until} onClick={() => run('extend')}>{t('admin.teams.extend')}</Button></div>
        <div className="admin-action-row"><label className="field-label" htmlFor="adm-tier">{t('admin.teams.licenseTier')}</label><select id="adm-tier" className="field-input" value={tier} onChange={e => setTier(e.target.value as typeof tier)}><option value="team25">{t("billing.team25")}</option><option value="team100">{t("billing.team100")}</option></select><Button variant="secondary" disabled={busy} onClick={() => run('license')}>{t('admin.teams.grantLicense')}</Button></div>
        <NoteField value={note} onChange={setNote} label={t('admin.reason')} />
        {team.suspension ? <Button variant="secondary" disabled={busy} onClick={() => run('restore')}>{t('admin.restore')}</Button> : <Button className="danger-button" disabled={busy || !note.trim()} onClick={() => run('suspend')}>{t('admin.teams.suspend')}</Button>}
      </section>
    </div>}
  </ResponsiveSheet>;
}

function Users() {
  const { t } = useTranslation(); const lang = useLang();
  const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const fn = useServerFn(listAdminUsers);
  const { data = [] } = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => fn({ data: { q } }) });
  return <section className="panel">
    <Search value={q} onChange={setQ} label={t('admin.users.search')} />
    <ul className="admin-list">{data.map(u => <li key={u.id}><button type="button" className="admin-row" onClick={() => setOpen(u.id)}>
      <span className="admin-row-main"><strong>{u.full_name || u.email}</strong><small>{u.email} · {t('admin.users.joined')}: {fmtDate(u.created_at, lang)}</small></span>
      <span className="admin-row-side"><span className="chip">{t(`admin.plan.${u.plan}`)}</span>{u.suspended && <span className="chip danger-chip">{t('admin.suspended')}</span>}</span>
      <GwIcon name="ChevronRight" size={18} /></button></li>)}
      {!data.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
    {open && <UserSheet id={open} onClose={() => setOpen(null)} />}
  </section>;
}

function UserSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const fn = useServerFn(getAdminUser); const act = useServerFn(adminUserAction);
  const { data: u } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => fn({ data: { id } }) });
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (action: 'resend' | 'suspend' | 'restore' | 'delete') => {
    if ((action === 'delete' || action === 'suspend') && !(await confirmAction({ title: t(action === 'delete' ? 'admin.users.delete' : 'admin.users.suspend'), body: action === 'delete' ? t('admin.users.deleteConfirm') : note, destructive: true, confirmLabel: t(action === 'delete' ? 'admin.users.deleteNow' : 'admin.users.suspend') }))) return;
    setBusy(true);
    try {
      const r = await act({ data: { userId: id, action, reason: note || undefined, origin: window.location.origin } });
      if (!r.ok) toast.error(errText(t, r.error));
      else { toast.success(t(action === 'resend' ? 'admin.users.linkSent' : 'admin.saved')); setNote(''); await qc.invalidateQueries({ queryKey: ['admin'] }); if (action === 'delete') onClose(); }
    } catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={u?.full_name || u?.email || t('admin.loading')} description={u?.email ?? ''}>
    {u && <div className="edit-form admin-detail">
      <dl className="admin-facts">
        <div><dt>{t('admin.users.plan')}</dt><dd>{t(`admin.plan.${u.plan.source === 'license' ? 'team' : u.plan.plan}`)}</dd></div>
        <div><dt>{t('admin.users.joined')}</dt><dd>{fmtDate(u.created_at, lang)}</dd></div>
        <div><dt>{t('admin.users.lastActive')}</dt><dd>{fmtDate(u.last_sign_in_at, lang, true)}</dd></div>
        <div><dt>{t('admin.users.role')}</dt><dd>{u.is_admin ? t('admin.users.platformAdmin') : t('admin.users.regular')}</dd></div>
      </dl>
      {u.suspension && <p className="chip danger-chip">{t('admin.suspended')}: {u.suspension.reason}</p>}
      <section><h3 className="admin-sub">{t('admin.users.teams')}</h3><ul className="admin-mini">{u.teams.length ? u.teams.map(m => <li key={m.team_id}>{m.name} <small>{t(`roles.${m.role}`, { defaultValue: m.role })}</small></li>) : <li className="muted-copy">{t('admin.empty')}</li>}</ul></section>
      <section className="admin-actions"><h3 className="admin-sub">{t('admin.actions')}</h3>
        <Button variant="secondary" disabled={busy} onClick={() => run('resend')}><GwIcon name="Mail" />{t('admin.users.resend')}</Button>
        <NoteField value={note} onChange={setNote} label={t('admin.reason')} />
        {u.suspension ? <Button variant="secondary" disabled={busy} onClick={() => run('restore')}>{t('admin.restore')}</Button> : <Button variant="secondary" disabled={busy || !note.trim()} onClick={() => run('suspend')}>{t('admin.users.suspend')}</Button>}
        <Button variant="destructive" disabled={busy || !note.trim()} onClick={() => void run('delete')}><GwIcon name="Trash2" />{t('admin.users.delete')}</Button>
      </section>
    </div>}
  </ResponsiveSheet>;
}

function Moderation() {
  const { t } = useTranslation(); const lang = useLang();
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const fn = useServerFn(listReports);
  const { data = [] } = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => fn({ data: { status } }) });
  const seen = new Set<string>(); const items = data.filter(r => (status === 'closed' || !seen.has(r.target_id)) && seen.add(r.target_id));
  return <>
    <Segmented value={status} options={['open', 'closed'] as const} onChange={setStatus} label={v => t(`admin.mod.${v}`)} />
    <div className="admin-cards">{items.map(r => <ReportCard key={r.id} r={r} lang={lang} />)}{!items.length && <section className="panel empty-panel"><GwFeatureTile name="ShieldCheck" /><p className="muted-copy">{t('admin.mod.none')}</p></section>}</div>
  </>;
}

function ReportCard({ r, lang }: { r: AdminReport; lang: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const act = useServerFn(moderateReport);
  const [note, setNote] = useState(''); const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false);
  const [text, setText] = useState(r.preview?.text ?? ''); const [textEs, setTextEs] = useState(r.preview?.text_es ?? '');
  const editable = r.target_type !== 'photo';
  const run = async (action: 'approve' | 'remove' | 'edit') => {
    setBusy(true);
    try {
      const res = await act({ data: { reportId: r.id, action, note: note || undefined, text: action === 'edit' ? text : undefined, textEs: action === 'edit' && r.target_type === 'event' ? textEs : undefined } });
      if (!res.ok) toast.error(errText(t, res.error)); else { toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin'] }); }
    } catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  return <article className="panel report-card">
    <div className="profile-chips"><span className="chip">{t(`admin.mod.type.${r.target_type}`)}</span><span className="chip warm-chip">{t(`report.reason.${r.reason}`)}</span><span className="chip">{r.source === 'claims' ? t('admin.mod.byClaims') : t('admin.mod.byUser', { count: r.open_count || 1 })}</span>{r.status !== 'open' && <span className="chip">{t(`admin.mod.status.${r.status}`)}</span>}</div>
    {r.preview?.title && <strong className="report-title">{r.preview.title}</strong>}
    {r.photo_url && <img className="report-photo" src={r.photo_url} alt={t('admin.mod.photoAlt')} />}
    {r.preview?.text && <p className="report-text">{r.preview.text}</p>}
    {!r.preview && <p className="muted-copy">{t('admin.mod.gone')}</p>}
    <p className="muted-copy">{[r.team_name, r.author_name && t('admin.mod.by', { name: r.author_name }), fmtDate(r.created_at, lang, true)].filter(Boolean).join(' · ')}</p>
    {r.note && <p className="report-note">“{r.note}”</p>}
    {r.resolution_note && <p className="muted-copy">{t('admin.mod.resolution')}: {r.resolution_note}</p>}
    {r.status === 'open' && r.preview && <>
      {editing && <div className="edit-form"><div className="form-field"><label className="field-label">{r.target_type === 'event' ? `${t('admin.mod.text')} · ${t('admin.languages.en')}` : t('admin.mod.text')}</label><Textarea rows={4} maxLength={2000} className="field-textarea" value={text} onChange={e => setText(e.target.value)} /></div>
        {r.target_type === 'event' && <div className="form-field"><label className="field-label">{t('admin.mod.text')} · {t('admin.languages.es')}</label><Textarea rows={4} maxLength={2000} className="field-textarea" value={textEs} onChange={e => setTextEs(e.target.value)} /></div>}</div>}
      <NoteField value={note} onChange={setNote} label={t('admin.note')} />
      <div className="report-actions">
        <Button variant="secondary" disabled={busy} onClick={() => run('approve')}><GwIcon name="Check" />{t('admin.mod.approve')}</Button>
        {editable && (editing ? <Button variant="secondary" disabled={busy} onClick={() => run('edit')}><GwIcon name="Save" />{t('admin.mod.saveEdit')}</Button> : <Button variant="secondary" onClick={() => setEditing(true)}><GwIcon name="Pencil" />{t('admin.mod.edit')}</Button>)}
        <Button className="danger-button" disabled={busy} onClick={() => run('remove')}><GwIcon name="Trash2" />{t('admin.mod.remove')}</Button>
      </div>
    </>}
  </article>;
}

function Verifications() {
  const { t } = useTranslation(); const lang = useLang();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const fn = useServerFn(listVerifications);
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'verify', status], queryFn: () => fn({ data: { status } }) });
  return <>
    <Segmented value={status} options={['pending', 'approved', 'rejected'] as const} onChange={setStatus} label={v => t(`admin.verify.${v}`)} />
    {isLoading ? <ListSkeleton /> : <div className="admin-cards">{data.map(v => <VerificationCard key={v.id} v={v} lang={lang} />)}{!data.length && <section className="panel empty-panel"><GwFeatureTile name="BadgeCheck" /><p className="muted-copy">{t('admin.verify.none')}</p></section>}</div>}
  </>;
}

function VerificationCard({ v, lang }: { v: AdminVerification; lang: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const act = useServerFn(decideVerification);
  const [note, setNote] = useState(''); const [keep, setKeep] = useState<number[]>(() => v.credentials.map((_, i) => i)); const [busy, setBusy] = useState(false);
  const run = async (approve: boolean) => {
    setBusy(true);
    try { const res = await act({ data: { id: v.id, approve, note: note || undefined, keep } }); if (!res.ok) toast.error(errText(t, res.error)); else { toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'verify'] }); } }
    catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  return <article className="panel report-card">
    <strong className="report-title">{v.name ?? '—'}</strong>
    <p className="muted-copy">{[v.email, fmtDate(v.created_at, lang, true), v.years_experience != null ? t('coachTrust.yearsValue', { count: v.years_experience }) : null].filter(Boolean).join(' · ')}</p>
    {v.identity_url && <a className="auth-link" href={v.identity_url} target="_blank" rel="noopener noreferrer"><GwIcon name="FileText" />{t('admin.verify.identity')}</a>}
    {v.credentials.length > 0 && <ul className="credential-list">{v.credentials.map((c, i) => <li key={i}>
      {v.status === 'pending' && <input type="checkbox" aria-label={t('admin.verify.keep', { title: c.title })} checked={keep.includes(i)} onChange={e => setKeep(k => e.target.checked ? [...k, i] : k.filter(x => x !== i))} />}
      <span><strong>{c.title}</strong><small>{[t(`coachTrust.kind.${c.kind}`), c.issuer].filter(Boolean).join(' · ')}</small></span>
      {c.doc_url ? <a className="auth-link" href={c.doc_url} target="_blank" rel="noopener noreferrer">{t('admin.verify.document')}</a> : <small className="muted-small">{t('admin.verify.noDocument')}</small>}
    </li>)}</ul>}
    {v.review_note && <p className="muted-copy">{t('admin.mod.resolution')}: {v.review_note}</p>}
    {v.status === 'pending' && <>
      <NoteField value={note} onChange={setNote} label={t('admin.verify.note')} />
      <div className="report-actions">
        <Button disabled={busy} onClick={() => run(true)}><GwIcon name="BadgeCheck" />{t('admin.verify.approve')}</Button>
        <Button variant="secondary" disabled={busy || !note.trim()} onClick={() => run(false)}><GwIcon name="X" />{t('admin.verify.reject')}</Button>
      </div>
    </>}
  </article>;
}

type LibKind = 'template' | 'recipe' | 'badge' | 'challenge_type';
type LibItem = Record<string, unknown> & { id: string };

function Library() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const [kind, setKind] = useState<LibKind>('template'); const [editing, setEditing] = useState<LibItem | 'new' | null>(null);
  const fn = useServerFn(getLibrary); const pub = useServerFn(setLibraryPublished); const reorder = useServerFn(reorderLibrary);
  const { data } = useQuery({ queryKey: ['admin', 'library'], queryFn: () => fn() });
  const list = (data ? { template: data.templates, recipe: data.recipes, badge: data.badges, challenge_type: data.challengeTypes }[kind] : []) as LibItem[];
  const titleOf = (it: LibItem) => String(kind === 'template' ? it['title'] : kind === 'badge' ? (lang === 'es' ? it['name_es'] : it['name_en']) : (lang === 'es' ? it['title_es'] : it['title_en']));
  const move = async (i: number, d: -1 | 1) => {
    const ids = list.map(x => x.id); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await reorder({ data: { kind, ids } }); await qc.invalidateQueries({ queryKey: ['admin', 'library'] });
  };
  const toggle = async (it: LibItem) => { if (kind === 'badge') return; await pub({ data: { kind, id: it.id, published: !it['is_published'] } }); await qc.invalidateQueries({ queryKey: ['admin', 'library'] }); };
  return <>
    <div className="admin-toolbar"><Segmented value={kind} options={['template', 'recipe', 'badge', 'challenge_type'] as const} onChange={setKind} label={v => t(`admin.lib.kind.${v}`)} /><Button onClick={() => setEditing('new')}><GwIcon name="Plus" />{t('admin.lib.new')}</Button></div>
    <section className="panel"><p className="muted-copy">{t(`admin.lib.help.${kind}`)}</p>
      <ul className="admin-list">{list.map((it, i) => <li key={it.id} className="admin-row lib-row">
        <span className="lib-order"><button type="button" aria-label={t('admin.lib.up')} disabled={i === 0} onClick={() => move(i, -1)}><GwIcon name="ChevronUp" size={18} /></button><button type="button" aria-label={t('admin.lib.down')} disabled={i === list.length - 1} onClick={() => move(i, 1)}><GwIcon name="ChevronDown" size={18} /></button></span>
        <span className="admin-row-main"><strong>{titleOf(it)}</strong><small>{kind === 'template' ? t('admin.teams.launches', { count: Number(it['launches_count'] ?? 0) }) : kind === 'challenge_type' ? t('challenges.days', { count: Number(it['duration_days']) }) : kind === 'badge' ? t(`admin.lib.tier.${String(it['tier'])}`) : (it['tags'] as string[] | undefined)?.join(', ')}</small></span>
        {kind !== 'badge' && <label className="lib-publish"><Switch checked={!!it['is_published']} onCheckedChange={() => toggle(it)} aria-label={t('admin.lib.published')} /><small>{it['is_published'] ? t('admin.lib.published') : t('admin.lib.hidden')}</small></label>}
        <Button variant="secondary" size="sm" onClick={() => setEditing(it)}><GwIcon name="Pencil" />{t('admin.lib.edit')}</Button>
      </li>)}{!list.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
    </section>
    {editing && <LibraryEditor kind={kind} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
  </>;
}

const linesOf = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []).join('\n');
const toLines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30);

function LibraryEditor({ kind, item, onClose }: { kind: LibKind; item: LibItem | null; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const save = useServerFn(saveLibraryItem);
  const g = (k: string) => (item?.[k] == null ? '' : String(item[k]));
  const nested = (k: string, l: 'en' | 'es') => linesOf((item?.[k] as Record<string, unknown> | undefined)?.[l]);
  const [f, setF] = useState<Record<string, string>>(() => ({
    title: g('title'), title_en: g('title_en'), title_es: g('title_es'), name_en: g('name_en'), name_es: g('name_es'),
    description_en: g('description_en'), description_es: g('description_es'), daily_prompt_en: g('daily_prompt_en'), daily_prompt_es: g('daily_prompt_es'),
    duration: g('default_duration_minutes') || '60', capacity: g('default_capacity'), checklist: linesOf(item?.['checklist']), days: g('duration_days') || '21',
    prep: g('prep_minutes'), tags: ((item?.['tags'] as string[] | undefined) ?? []).join(', '), ing_en: nested('ingredients', 'en'), ing_es: nested('ingredients', 'es'),
    steps_en: nested('steps', 'en'), steps_es: nested('steps', 'es'), icon: g('icon') || 'Award', tier: g('tier') || 'bronze',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const nOrNull = (s: string) => (s.trim() ? Number(s) : null); const sOrNull = (s: string) => s.trim() || null;
  const fields = () => {
    if (kind === 'template') return { title: (f['title'] ?? ''), description_en: sOrNull((f['description_en'] ?? '')), description_es: sOrNull((f['description_es'] ?? '')), default_duration_minutes: Number(f['duration']), default_capacity: nOrNull((f['capacity'] ?? '')), checklist: toLines((f['checklist'] ?? '')) };
    if (kind === 'recipe') return { title_en: (f['title_en'] ?? ''), title_es: (f['title_es'] ?? ''), prep_minutes: nOrNull((f['prep'] ?? '')), tags: (f['tags'] ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 10), ingredients: { en: toLines((f['ing_en'] ?? '')), es: toLines((f['ing_es'] ?? '')) }, steps: { en: toLines((f['steps_en'] ?? '')), es: toLines((f['steps_es'] ?? '')) } };
    if (kind === 'badge') return { name_en: (f['name_en'] ?? ''), name_es: (f['name_es'] ?? ''), description_en: sOrNull((f['description_en'] ?? '')), description_es: sOrNull((f['description_es'] ?? '')), icon: (f['icon'] ?? ''), tier: (f['tier'] ?? '') };
    return { title_en: (f['title_en'] ?? ''), title_es: (f['title_es'] ?? ''), description_en: sOrNull((f['description_en'] ?? '')), description_es: sOrNull((f['description_es'] ?? '')), daily_prompt_en: sOrNull((f['daily_prompt_en'] ?? '')), daily_prompt_es: sOrNull((f['daily_prompt_es'] ?? '')), duration_days: Number(f['days']) };
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await save({ data: { kind, id: item?.id, fields: fields() } });
      if (!r.ok) toast.error(errText(t, r.error)); else { toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'library'] }); onClose(); }
    } catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  const input = (k: string, label: string, type = 'text') => <div className="form-field"><label className="field-label" htmlFor={`lib-${k}`}>{label}</label><Input id={`lib-${k}`} type={type} className="field-input" maxLength={120} value={f[k]} onChange={set(k)} /></div>;
  const area = (k: string, label: string, rows = 3) => <div className="form-field"><label className="field-label" htmlFor={`lib-${k}`}>{label}</label><Textarea id={`lib-${k}`} rows={rows} maxLength={3000} className="field-textarea" value={f[k]} onChange={set(k)} /></div>;
  const pair = (a: ReactNode, b: ReactNode) => <div className="bilingual">{a}{b}</div>;
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={item ? t('admin.lib.editTitle') : t('admin.lib.newTitle', { kind: t(`admin.lib.kind.${kind}`) })} description={t('admin.lib.claimRule')}>
    <div className="edit-form">
      {kind === 'template' && <>{input('title', t('admin.lib.f.title'))}{pair(area('description_en', `${t('admin.lib.f.description')} · ${t('admin.languages.en')}`), area('description_es', `${t('admin.lib.f.description')} · ${t('admin.languages.es')}`))}
        {pair(input('duration', t('admin.lib.f.duration'), 'number'), input('capacity', t('admin.lib.f.capacity'), 'number'))}{area('checklist', t('admin.lib.f.checklist'), 5)}</>}
      {kind === 'recipe' && <>{pair(input('title_en', `${t('admin.lib.f.title')} · ${t('admin.languages.en')}`), input('title_es', `${t('admin.lib.f.title')} · ${t('admin.languages.es')}`))}{pair(input('prep', t('admin.lib.f.prep'), 'number'), input('tags', t('admin.lib.f.tags')))}
        {pair(area('ing_en', `${t('admin.lib.f.ingredients')} · ${t('admin.languages.en')}`, 5), area('ing_es', `${t('admin.lib.f.ingredients')} · ${t('admin.languages.es')}`, 5))}{pair(area('steps_en', `${t('admin.lib.f.steps')} · ${t('admin.languages.en')}`, 5), area('steps_es', `${t('admin.lib.f.steps')} · ${t('admin.languages.es')}`, 5))}</>}
      {kind === 'badge' && <>{pair(input('name_en', `${t('admin.lib.f.name')} · ${t('admin.languages.en')}`), input('name_es', `${t('admin.lib.f.name')} · ${t('admin.languages.es')}`))}{pair(area('description_en', `${t('admin.lib.f.description')} · ${t('admin.languages.en')}`), area('description_es', `${t('admin.lib.f.description')} · ${t('admin.languages.es')}`))}
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="lib-icon">{t('admin.lib.f.icon')}</label><Select value={f['icon'] ?? 'Award'} onValueChange={icon => setF(current => ({ ...current, icon }))}><SelectTrigger id="lib-icon"><SelectValue /></SelectTrigger><SelectContent>{(['Award', 'Medal', 'Trophy', 'Star', 'Heart', 'HandHeart', 'Flame', 'Crown', 'CalendarHeart', 'UsersRound', 'Footprints', 'Leaf', 'Rocket', 'Megaphone'] as const).map(icon => <SelectItem key={icon} value={icon}><span className="flex items-center gap-2"><GwIcon name={icon} />{t(`admin.lib.icons.${icon}`)}</span></SelectItem>)}</SelectContent></Select></div>
          <div className="form-field"><label className="field-label" htmlFor="lib-tier">{t('admin.lib.f.tier')}</label><select id="lib-tier" className="field-input" value={f['tier']} onChange={set('tier')}>{['bronze', 'silver', 'gold'].map(x => <option key={x} value={x}>{t(`admin.lib.tier.${x}`)}</option>)}</select></div></div></>}
      {kind === 'challenge_type' && <>{pair(input('title_en', `${t('admin.lib.f.title')} · ${t('admin.languages.en')}`), input('title_es', `${t('admin.lib.f.title')} · ${t('admin.languages.es')}`))}{pair(area('description_en', `${t('admin.lib.f.description')} · ${t('admin.languages.en')}`), area('description_es', `${t('admin.lib.f.description')} · ${t('admin.languages.es')}`))}
        {pair(input('daily_prompt_en', `${t('admin.lib.f.prompt')} · ${t('admin.languages.en')}`), input('daily_prompt_es', `${t('admin.lib.f.prompt')} · ${t('admin.languages.es')}`))}{input('days', t('admin.lib.f.days'), 'number')}</>}
      {!item && kind !== 'badge' && <p className="muted-copy">{t('admin.lib.startsHidden')}</p>}
      <div className="confirm-actions"><Button variant="secondary" onClick={onClose}>{t('admin.keep')}</Button><Button disabled={busy} onClick={submit}>{t('admin.lib.save')}</Button></div>
    </div>
  </ResponsiveSheet>;
}

function Broadcasts() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const fn = useServerFn(getBroadcasts); const send = useServerFn(sendBroadcast); const end = useServerFn(endBroadcast);
  const { data } = useQuery({ queryKey: ['admin', 'broadcasts'], queryFn: () => fn() });
  const [f, setF] = useState({ audience: 'leaders' as 'leaders' | 'members', title_en: '', title_es: '', body_en: '', body_es: '' });
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>(lang); const [busy, setBusy] = useState(false);
  const ok = !!(f.title_en.trim() && f.title_es.trim() && f.body_en.trim() && f.body_es.trim());
  const go = async (test: boolean) => {
    if (!test && !(await confirmAction({ title: t('admin.bc.send'), body: t('admin.bc.confirm', { audience: t(`admin.bc.${f.audience}`) }), confirmLabel: t('admin.bc.sendNow') }))) return;
    setBusy(true);
    try {
      const r = await send({ data: { ...f, test } });
      if (!r.ok) toast.error(errText(t, r.error)); else { toast.success(t(test ? 'admin.bc.testSent' : 'admin.bc.sent', { count: r.recipients })); if (!test) setF({ ...f, title_en: '', title_es: '', body_en: '', body_es: '' }); await qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] }); await qc.invalidateQueries({ queryKey: ['my-broadcast'] }); }
    } catch { toast.error(t('admin.errors.failed')); }
    setBusy(false);
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return <>
    <section className="panel"><h2 className="section-title">{t('admin.bc.compose')}</h2>
      {data && !data.emailConnected && <p className="not-connected-note"><GwIcon name="CircleHelp" size={16} />{t('admin.bc.simulated')}</p>}
      <div className="edit-form">
        <div className="form-field"><label className="field-label" htmlFor="bc-aud">{t('admin.bc.audience')}</label><select id="bc-aud" className="field-input" value={f.audience} onChange={set('audience')}><option value="leaders">{t('admin.bc.leaders')}</option><option value="members">{t('admin.bc.members')}</option></select></div>
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="bc-ten">{t('admin.bc.titleField')} · {t('admin.languages.en')}</label><Input id="bc-ten" maxLength={120} className="field-input" value={f.title_en} onChange={set('title_en')} /></div><div className="form-field"><label className="field-label" htmlFor="bc-tes">{t('admin.bc.titleField')} · {t('admin.languages.es')}</label><Input id="bc-tes" maxLength={120} className="field-input" value={f.title_es} onChange={set('title_es')} /></div></div>
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="bc-ben">{t('admin.bc.body')} · {t('admin.languages.en')}</label><Textarea id="bc-ben" rows={4} maxLength={2000} className="field-textarea" value={f.body_en} onChange={set('body_en')} /></div><div className="form-field"><label className="field-label" htmlFor="bc-bes">{t('admin.bc.body')} · {t('admin.languages.es')}</label><Textarea id="bc-bes" rows={4} maxLength={2000} className="field-textarea" value={f.body_es} onChange={set('body_es')} /></div></div>
        <div className="form-field"><span className="field-label">{t('admin.bc.preview')}</span><Segmented value={previewLang} options={['en', 'es'] as const} onChange={setPreviewLang} label={v => t(`admin.languages.${v}`)} />
          <div className="notice-banner"><GwIcon name="Megaphone" /><div><strong>{(previewLang === 'es' ? f.title_es : f.title_en) || t('admin.bc.titleField')}</strong><p>{(previewLang === 'es' ? f.body_es : f.body_en) || t('admin.bc.body')}</p></div></div></div>
        <div className="confirm-actions"><Button variant="secondary" disabled={!ok || busy} onClick={() => void go(true)}>{t('admin.bc.sendTest')}</Button><Button disabled={!ok || busy} onClick={() => void go(false)}>{t('admin.bc.send')}</Button></div>
      </div>
    </section>
    <section className="panel"><h2 className="section-title">{t('admin.bc.history')}</h2>
      <ul className="admin-list">{(data?.list ?? []).map(b => <li key={b.id} className="admin-row">
        <span className="admin-row-main"><strong>{lang === 'es' ? b.title_es : b.title_en}{b.is_test && <small className="chip">{t('admin.bc.test')}</small>}</strong>
          <small>{t(`admin.bc.${b.audience}`)} · {fmtDate(b.created_at, lang, true)} · {t('admin.bc.recipients', { count: b.recipients })}</small>
          <small className="tabular-nums">{t('admin.bc.counts', { sent: b.counts['sent'] ?? 0, simulated: b.counts['simulated'] ?? 0, pending: (b.counts['pending'] ?? 0) + (b.counts['sending'] ?? 0), skipped: (b.counts['skipped'] ?? 0) + (b.counts['failed'] ?? 0), seen: b.seen })}</small></span>
        {b.active ? <Button variant="secondary" size="sm" onClick={async () => { if (!(await confirmAction({ title: t('admin.bc.end'), destructive: true, confirmLabel: t('admin.bc.end') }))) return; await end({ data: { id: b.id } }); await qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] }); }}>{t('admin.bc.end')}</Button> : <span className="chip">{t('admin.bc.ended')}</span>}
      </li>)}{!data?.list.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
    </section>
  </>;
}

function Settings() {
  const { t } = useTranslation();
  return <>
    <section className="panel"><Link to="/admin/site-media" className="settings-row"><GwIcon name="ImageDown" className="settings-icon" /><span className="settings-label">{t('siteMedia.menu')}</span><GwIcon name="ChevronRight" className="settings-chevron" /></Link></section>
    <PlanSettingsPanel />
  </>;
}

/** Launch-mode switches (/admin?tab=flags): every row in feature_flags with its plain-language description. */
function FlagsPanel() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const fn = useServerFn(getFlags); const save = useServerFn(setFlag);
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => fn() });
  const update = async (key: string, enabled: boolean, value: string | null) => {
    const r = await save({ data: { key, enabled, value } });
    if (!r.ok) toast.error(t('admin.errors.failed')); else { toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); await qc.invalidateQueries({ queryKey: ['feature-flags'] }); }
  };
  if (isLoading) return <ListSkeleton />;
  return <section className="panel"><h2 className="section-title">{t('admin.flags.title')}</h2><p className="muted-copy">{t('admin.flags.intro')}</p>
    <ul className="admin-list">{data.map(fl => <li key={fl.key} className="admin-row flag-row">
      <span className="admin-row-main"><strong>{t(`admin.flags.name.${fl.key}`, { defaultValue: fl.key })}</strong><small>{(lang === 'es' ? fl.description_es : fl.description_en) || t(`admin.flags.desc.${fl.key}`, { defaultValue: t('admin.flags.noDescription') })}</small></span>
      {fl.key === 'landing_headline' && <select aria-label={t('admin.flags.variant')} className="field-input flag-select" value={fl.value ?? 'A'} onChange={e => update(fl.key, fl.enabled, e.target.value)}>{['A', 'B', 'C', 'D'].map(v => <option key={v} value={v}>{t('admin.flags.headline', { v })}</option>)}</select>}
      <Switch checked={fl.enabled} onCheckedChange={v => update(fl.key, v, fl.value)} aria-label={t(`admin.flags.name.${fl.key}`, { defaultValue: fl.key })} />
    </li>)}</ul>
  </section>;
}

function PlanSettingsPanel() {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data } = useQuery(planSettingsQuery);
  if (!data) return <ListSkeleton rows={2} />;
  return <section className="panel"><h2 className="section-title">{t('admin.planSettings.title')}</h2><p className="field-hint">{t('admin.planSettings.hint')}</p>
    {(['free', 'pro'] as const).map(id => <PlanSettingRow key={id} s={data[id]} onSaved={() => void qc.invalidateQueries({ queryKey: ['plan-settings'] })} />)}
  </section>;
}
function PlanSettingRow({ s, onSaved }: { s: PlanSetting; onSaved: () => void }) {
  const { t } = useTranslation(); const save = useServerFn(updatePlanSettings);
  const [fee, setFee] = useState(String(s.fee_percent)); const [cap, setCap] = useState(s.monthly_cap === null ? '' : String(s.monthly_cap / 100)); const [price, setPrice] = useState(String(s.monthly_price / 100));
  const [svcPct, setSvcPct] = useState(String(s.service_fee_percent)); const [svcFixed, setSvcFixed] = useState(String(s.service_fee_fixed / 100));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const f = Number(fee), c = cap.trim() === '' ? null : Math.round(Number(cap) * 100), p = Math.round(Number(price) * 100);
    const sp = Number(svcPct), sf = Math.round(Number(svcFixed) * 100);
    if (![f, p, sp, sf].every(Number.isFinite) || (c !== null && !Number.isFinite(c))) { toast.error(t('admin.errors.failed')); return; }
    setBusy(true); const r = await save({ data: { plan: s.plan as 'free' | 'pro', fee_percent: f, monthly_cap: c, monthly_price: p, service_fee_percent: sp, service_fee_fixed: sf } }).catch(() => ({ ok: false as const })); setBusy(false);
    if (r.ok) { toast.success(t('admin.saved')); onSaved(); } else toast.error(t('admin.errors.failed'));
  };
  const id = `ps-${s.plan}`;
  return <div className="admin-plan-setting"><h3>{t(`billing.name_${s.plan}`)}</h3>
    <div className="admin-plan-fields">
      <label className="field-label" htmlFor={`${id}-fee`}>{t('admin.planSettings.fee')}<Input id={`${id}-fee`} inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} /></label>
      <label className="field-label" htmlFor={`${id}-cap`}>{t('admin.planSettings.cap')}<Input id={`${id}-cap`} inputMode="decimal" placeholder={t('admin.planSettings.noCap')} value={cap} onChange={e => setCap(e.target.value)} /></label>
      <label className="field-label" htmlFor={`${id}-price`}>{t('admin.planSettings.price')}<Input id={`${id}-price`} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label className="field-label" htmlFor={`${id}-svc`}>{t('admin.planSettings.servicePct')}<Input id={`${id}-svc`} inputMode="decimal" value={svcPct} onChange={e => setSvcPct(e.target.value)} /></label>
      <label className="field-label" htmlFor={`${id}-svcfix`}>{t('admin.planSettings.serviceFixed')}<Input id={`${id}-svcfix`} inputMode="decimal" value={svcFixed} onChange={e => setSvcFixed(e.target.value)} /></label>
    </div>
    <Button variant="secondary" disabled={busy} onClick={() => void submit()}>{t('admin.planSettings.save')}</Button>
  </div>;
}

const AREAS = ['all', 'team', 'user', 'moderation', 'library', 'broadcast', 'flag', 'mail'] as const;
function Audit() {
  const { t } = useTranslation(); const lang = useLang();
  const [q, setQ] = useState(''); const [area, setArea] = useState<(typeof AREAS)[number]>('all'); const [open, setOpen] = useState<string | null>(null);
  const fn = useServerFn(getAudit);
  const { data = [] } = useQuery({ queryKey: ['admin', 'audit', q, area], queryFn: () => fn({ data: { q, area } }) });
  return <section className="panel">
    <div className="admin-toolbar"><Search value={q} onChange={setQ} label={t('admin.audit.search')} /><select aria-label={t('admin.audit.area')} className="field-input audit-area" value={area} onChange={e => setArea(e.target.value as typeof area)}>{AREAS.map(a => <option key={a} value={a}>{t(`admin.audit.areas.${a}`)}</option>)}</select></div>
    <ul className="admin-list">{data.map(r => <li key={r.id}><button type="button" className="admin-row" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
      <span className="admin-row-main"><strong>{t(`admin.audit.actions.${r.action.replace('.', '_')}`, { defaultValue: r.action })}</strong><small>{r.actor_name ?? '—'} · {fmtDate(r.created_at, lang, true)} · {r.target_type}{r.target_id ? ` ${r.target_id.slice(0, 8)}` : ''}</small>{r.note && <small>“{r.note}”</small>}</span>
      <GwIcon name={open === r.id ? 'ChevronUp' : 'ChevronDown'} size={18} /></button>
      {open === r.id && <div className="audit-diff"><div><span className="field-label">{t('admin.audit.before')}</span><pre>{JSON.stringify(r.before, null, 2) ?? '—'}</pre></div><div><span className="field-label">{t('admin.audit.after')}</span><pre>{JSON.stringify(r.after, null, 2) ?? '—'}</pre></div></div>}
    </li>)}{!data.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
  </section>;
}

function TextMonitor() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const list = useServerFn(listRecentTexts); const sim = useServerFn(simulateSmsReply);
  const { data } = useQuery({ queryKey: ['admin', 'texts'], queryFn: () => list() });
  const [from, setFrom] = useState(''); const [body, setBody] = useState('IN'); const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setResult(null);
    try { const r = await sim({ data: { from, body } }); setResult(r.ok ? r.result : 'failed'); } catch { setResult('failed'); }
    setBusy(false); void qc.invalidateQueries({ queryKey: ['admin', 'texts'] });
  };
  return <section className="panel text-monitor"><h2 className="section-title">{t('admin.texts.title')}</h2>
    {data && !data.smsConnected && <p className="not-connected">{t('admin.notConnected')}</p>}
    <div className="text-sim"><h3>{t('admin.texts.simTitle')}</h3><p className="muted-copy">{t('admin.texts.simBody')}</p>
      <div className="text-sim-row">
        <div className="form-field"><label className="field-label" htmlFor="sim-from">{t('admin.texts.phone')}</label><Input id="sim-from" className="field-input" inputMode="tel" placeholder="+15555550123" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-field"><label className="field-label" htmlFor="sim-body">{t('admin.texts.reply')}</label><Input id="sim-body" className="field-input" maxLength={160} value={body} onChange={e => setBody(e.target.value)} /></div>
        <Button disabled={busy || from.trim().length < 7 || !body.trim()} onClick={run}>{t('admin.texts.run')}</Button>
      </div>
      {result && <p className="chip" role="status">{t('admin.texts.result', { result })}</p>}
    </div>
    {data && data.invites.length > 0 && <><h3>{t('admin.texts.latestInvites')}</h3><ul className="text-log">{data.invites.map(i => <li key={i.id}><span className="tabular-nums">{i.phone}</span><span>{i.reply ?? '—'}</span><span className="muted-copy">{fmtDate(i.created_at, lang, true)}</span></li>)}</ul></>}
    {!data?.texts.length ? <p className="muted-copy">{t('admin.texts.empty')}</p> :
      <div className="admin-table-wrap"><table className="admin-table"><tbody>{data.texts.map(m => <tr key={m.id}><td className="tabular-nums">{m.recipient}</td><td>{m.template}</td><td><span className="chip">{t(`admin.messages.${m.status === 'pending' || m.status === 'sending' ? 'queued' : m.status}`)}</span></td><td className="muted-copy">{fmtDate(m.created_at, lang, true)}</td></tr>)}</tbody></table></div>}
  </section>;
}

const mask = (r: string) => r.includes('@') ? r.replace(/^(.{1,2}).*(@.*)$/, '$1***$2') : r.length > 4 ? `${'*'.repeat(r.length - 4)}${r.slice(-4)}` : r;
const MAIL_CHANNELS = ['all', 'email', 'sms', 'push'] as const;
const MAIL_STATUSES = ['all', 'pending', 'sent', 'simulated', 'failed', 'skipped'] as const;

function MailLog() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const [channel, setChannel] = useState<(typeof MAIL_CHANNELS)[number]>('all');
  const [status, setStatus] = useState<(typeof MAIL_STATUSES)[number]>('all');
  const [template, setTemplate] = useState(''); const [q, setQ] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [pages, setPages] = useState(1); const [shown, setShown] = useState<Set<string>>(new Set());
  const fn = useServerFn(listMail);
  const retry = useServerFn(retryMail);
  const [retrying, setRetrying] = useState<string | null>(null);
  const retryMessage = async (id: string) => {
    if (retrying) return;
    setRetrying(id);
    try {
      if (!(await confirmAction({ title: t('admin.mail.retryTitle'), body: t('admin.mail.retryBody'), confirmLabel: t('admin.mail.retry') }))) return;
      const result = await retry({ data: { id } });
      if (result.ok) toast.success(t('admin.mail.retryQueued'));
      else toast.error(t('admin.mail.retryUnavailable'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'mail'] }), qc.invalidateQueries({ queryKey: ['admin', 'audit'] })]);
    } catch { toast.error(t('admin.mail.retryError')); }
    finally { setRetrying(null); }
  };
  const filters = { channel, status, template, q, from, to };
  const { data } = useQuery({ queryKey: ['admin', 'mail', filters, pages], refetchInterval: 30000,
    queryFn: async () => { const all = await Promise.all(Array.from({ length: pages }, (_, page) => fn({ data: { ...filters, page } }))); const first = all[0]; if (!first) throw new Error('empty_mail_pages'); return { ...first, rows: all.flatMap(a => a.rows) }; } });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPages(1); };
  const anySim = data && (!data.providers.email || !data.providers.sms || !data.providers.push);
  return <section className="panel mail-log">
    <div className="admin-stats">
      <Stat icon="Clock" label={t('admin.mail.queued')} value={num(data?.counters.queued, lang)} />
      <Stat icon="Send" label={t('admin.mail.sentToday')} value={num(data?.counters.sentToday, lang)} sub={`${t('admin.mail.simulatedToday')}: ${num(data?.counters.simulatedToday, lang)}`} />
      <Stat icon="AlertCircle" label={t('admin.mail.failedToday')} value={num(data?.counters.failedToday, lang)} />
    </div>
    {data && <div className="mail-providers"><span className="field-label">{t('admin.mail.providers')}</span>{(['email', 'sms', 'push'] as const).map(k => <span key={k} className={`status-chip ${data.providers[k] ? 'is-live' : 'is-sim'}`}>{t(`admin.mail.${k}`)}: {t(data.providers[k] ? 'admin.mail.live' : 'admin.mail.simulated')}</span>)}</div>}
    {anySim && <p className="not-connected">{t('admin.mail.simNote')}</p>}
    <div className="admin-toolbar mail-filters">
      <Search value={q} onChange={reset(setQ)} label={t('admin.mail.search')} />
      <select aria-label={t('admin.mail.channel')} className="field-input" value={channel} onChange={e => reset(setChannel)(e.target.value as typeof channel)}>{MAIL_CHANNELS.map(c => <option key={c} value={c}>{c === 'all' ? t('admin.mail.allChannels') : t(`admin.mail.${c}`)}</option>)}</select>
      <select aria-label={t('admin.mail.status')} className="field-input" value={status} onChange={e => reset(setStatus)(e.target.value as typeof status)}>{MAIL_STATUSES.map(c => <option key={c} value={c}>{c === 'all' ? t('admin.mail.allStatuses') : t(`admin.mail.statuses.${c}`)}</option>)}</select>
      <select aria-label={t('admin.mail.template')} className="field-input" value={template} onChange={e => reset(setTemplate)(e.target.value)}><option value="">{t('admin.mail.allTemplates')}</option>{data?.templates.map(x => <option key={x} value={x}>{x}</option>)}</select>
      <label className="form-field"><span className="field-label">{t('admin.mail.from')}</span><Input type="date" className="field-input" value={from} onChange={e => reset(setFrom)(e.target.value)} /></label>
      <label className="form-field"><span className="field-label">{t('admin.mail.to')}</span><Input type="date" className="field-input" value={to} onChange={e => reset(setTo)(e.target.value)} /></label>
    </div>
    {data && <p className="muted-copy">{t('admin.mail.total', { count: data.total })}</p>}
    <ul className="admin-list">{data?.rows.map(r => <li key={r.id} className="admin-row mail-row">
      <span className="admin-row-main">
        <strong>{r.template}</strong>
        <small>{fmtDate(r.created_at, lang, true)} · {t(`admin.mail.${r.channel}`)} · {r.language.toUpperCase()}</small>
        <button type="button" className="link-button" aria-label={t('admin.mail.reveal')} onClick={() => setShown(s => new Set(s).add(r.id))}>{shown.has(r.id) ? r.recipient : mask(r.recipient)}</button>
        {r.error && <small>{r.error}</small>}
      </span>
      <div className="flex shrink-0 flex-col items-end gap-2"><span className={`status-chip is-${r.status === 'sending' ? 'pending' : r.status}`}>{t(`admin.mail.statuses.${r.status}`)}</span>
      {r.retryable && <Button variant="ghost" size="icon" disabled={retrying !== null} aria-label={t('admin.mail.retry')} title={t('admin.mail.retry')} onClick={() => void retryMessage(r.id)}><GwIcon name="RefreshCw" size={20} /></Button>}</div>
    </li>)}{data && !data.rows.length && <li className="muted-copy">{t('admin.mail.empty')}</li>}</ul>
    {data && data.rows.length < data.total && <Button variant="secondary" onClick={() => setPages(p => p + 1)}>{t('admin.mail.loadMore')}</Button>}
  </section>;
}

function SupportTickets() {
  const { t } = useTranslation(); const lang = useLang();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'open' | 'answered' | 'closed'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const listFn = useServerFn(listAdminTickets);
  const replyFn = useServerFn(replyAdminTicket);
  const closeFn = useServerFn(closeAdminTicket);
  const { data: tickets, isLoading } = useQuery({ queryKey: ['admin-tickets', status], queryFn: () => listFn({ data: { status } }) });

  const sendReply = async (id: string) => {
    const res = await replyFn({ data: { ticketId: id, body: reply } });
    if (!res.ok) { toast.error(errText(t, res.error)); return; }
    toast.success(t('admin.support.replied'));
    setReply(''); setOpenId(null);
    await queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
  };
  const close = async (id: string) => {
    if (!await confirmAction({ title: t('admin.support.close'), body: t('admin.support.confirmClose'), confirmLabel: t('admin.support.close') })) return;
    const res = await closeFn({ data: { ticketId: id } });
    if (!res.ok) { toast.error(errText(t, res.error)); return; }
    toast.success(t('admin.support.closedToast'));
    await queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
  };

  return <section className="panel">
    <div className="section-heading"><h2>{t('admin.support.title')}</h2></div>
    <Segmented value={status} options={['open', 'answered', 'closed'] as const} onChange={setStatus} label={v => t(`admin.support.filters.${v}`)} />
    {isLoading ? <ListSkeleton /> : !tickets?.length ? <p className="muted-copy">{t('admin.support.empty')}</p> : (
      <ul className="admin-list">{tickets.map((tk: AdminTicket) => (
        <li key={tk.id} className="admin-row">
          <div className="admin-row-main">
            <strong>{tk.subject}</strong>
            <small>{t(`support.categories.${tk.category}`, { defaultValue: tk.category })} · {t('admin.support.requester')}: {tk.requester ?? '—'} · {fmtDate(tk.updated_at, lang, true)} · {t('admin.support.messages')}: {tk.messages}</small>
            {tk.last_message && <p className="muted-copy">{tk.last_message.is_staff ? '↩ ' : ''}{tk.last_message.body}</p>}
          </div>
          {tk.status !== 'closed' && <div className="admin-row-actions">
            <Button variant="secondary" size="sm" onClick={() => { setOpenId(openId === tk.id ? null : tk.id); setReply(''); }}>{t('admin.support.reply')}</Button>
            <Button variant="ghost" size="sm" onClick={() => void close(tk.id)}>{t('admin.support.close')}</Button>
          </div>}
          {openId === tk.id && <div className="admin-reply">
            <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t('admin.support.replyPlaceholder')} rows={3} maxLength={4000} aria-label={t('admin.support.reply')} />
            <Button size="sm" disabled={!reply.trim()} onClick={() => void sendReply(tk.id)}>{t('admin.support.reply')}</Button>
          </div>}
        </li>
      ))}</ul>
    )}
  </section>;
}
