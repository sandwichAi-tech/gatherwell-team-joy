import { useState, type ReactNode } from 'react';
import { ListSkeleton } from '@/components/launch-states';
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
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GwFeatureTile, GwIcon, type GwIconProps } from '@/components/gw-icon';
import { formatMoney } from '@/lib/billing';
import {
  adminTeamAction, adminUserAction, endBroadcast, getAdminAccess, getAdminOverview, getAdminTeam, getAdminUser, getAudit, getBroadcasts, getFlags, getLibrary,
  listAdminTeams, listAdminUsers, listReports, moderateReport, reorderLibrary, saveLibraryItem, sendBroadcast, setFlag, setLibraryPublished, type AdminReport,
} from '@/lib/admin.functions';

export const ADMIN_TABS = ['overview', 'teams', 'users', 'moderation', 'library', 'broadcasts', 'settings', 'audit'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
const TAB_ICONS: Record<AdminTab, GwIconProps['name']> = { overview: 'BarChart3', teams: 'UsersRound', users: 'UserRound', moderation: 'Flag', library: 'BookOpen', broadcasts: 'Megaphone', settings: 'Settings2', audit: 'FileText' };

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
    {tab === 'teams' && <Teams />}
    {tab === 'users' && <Users />}
    {tab === 'moderation' && <Moderation />}
    {tab === 'library' && <Library />}
    {tab === 'broadcasts' && <Broadcasts />}
    {tab === 'settings' && <Settings />}
    {tab === 'audit' && <Audit />}
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
  const { data: o } = useQuery({ queryKey: ['admin', 'overview', period], queryFn: () => fn({ data: { period } }) });
  const channels = ['email', 'sms', 'push'] as const; const states = ['queued', 'sent', 'simulated', 'failed', 'skipped'] as const;
  return <>
    <Segmented value={period} options={['week', 'month', 'all'] as const} onChange={setPeriod} label={v => t(`admin.period.${v}`)} />
    {!o ? <p className="muted-copy">{t('admin.loading')}</p> : <>
      <div className="admin-stats">
        <Stat icon="UserPlus" label={t('admin.stats.signups')} value={num(o.signups, lang)} />
        <Stat icon="UsersRound" label={t('admin.stats.activeTeams')} value={num(o.active_teams, lang)} />
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
    if ((action === 'delete' || action === 'suspend') && !(await confirmAction({ title: t(action === 'delete' ? 'admin.users.delete' : 'admin.users.suspend'), body: t('admin.users.deleteConfirm'), destructive: true, confirmLabel: t(action === 'delete' ? 'admin.users.deleteNow' : 'admin.users.suspend') }))) return;
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
      {editing && <div className="edit-form"><div className="form-field"><label className="field-label">{r.target_type === 'event' ? `${t('admin.mod.text')} · EN` : t('admin.mod.text')}</label><Textarea rows={4} maxLength={2000} className="field-textarea" value={text} onChange={e => setText(e.target.value)} /></div>
        {r.target_type === 'event' && <div className="form-field"><label className="field-label">{t('admin.mod.text')} · ES</label><Textarea rows={4} maxLength={2000} className="field-textarea" value={textEs} onChange={e => setTextEs(e.target.value)} /></div>}</div>}
      <NoteField value={note} onChange={setNote} label={t('admin.note')} />
      <div className="report-actions">
        <Button variant="secondary" disabled={busy} onClick={() => run('approve')}><GwIcon name="Check" />{t('admin.mod.approve')}</Button>
        {editable && (editing ? <Button variant="secondary" disabled={busy} onClick={() => run('edit')}><GwIcon name="Save" />{t('admin.mod.saveEdit')}</Button> : <Button variant="secondary" onClick={() => setEditing(true)}><GwIcon name="Pencil" />{t('admin.mod.edit')}</Button>)}
        <Button className="danger-button" disabled={busy} onClick={() => run('remove')}><GwIcon name="Trash2" />{t('admin.mod.remove')}</Button>
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
      {kind === 'template' && <>{input('title', t('admin.lib.f.title'))}{pair(area('description_en', `${t('admin.lib.f.description')} · EN`), area('description_es', `${t('admin.lib.f.description')} · ES`))}
        {pair(input('duration', t('admin.lib.f.duration'), 'number'), input('capacity', t('admin.lib.f.capacity'), 'number'))}{area('checklist', t('admin.lib.f.checklist'), 5)}</>}
      {kind === 'recipe' && <>{pair(input('title_en', `${t('admin.lib.f.title')} · EN`), input('title_es', `${t('admin.lib.f.title')} · ES`))}{pair(input('prep', t('admin.lib.f.prep'), 'number'), input('tags', t('admin.lib.f.tags')))}
        {pair(area('ing_en', `${t('admin.lib.f.ingredients')} · EN`, 5), area('ing_es', `${t('admin.lib.f.ingredients')} · ES`, 5))}{pair(area('steps_en', `${t('admin.lib.f.steps')} · EN`, 5), area('steps_es', `${t('admin.lib.f.steps')} · ES`, 5))}</>}
      {kind === 'badge' && <>{pair(input('name_en', `${t('admin.lib.f.name')} · EN`), input('name_es', `${t('admin.lib.f.name')} · ES`))}{pair(area('description_en', `${t('admin.lib.f.description')} · EN`), area('description_es', `${t('admin.lib.f.description')} · ES`))}
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="lib-icon">{t('admin.lib.f.icon')}</label><Select value={f['icon']} onValueChange={icon => setF(current => ({ ...current, icon }))}><SelectTrigger id="lib-icon"><SelectValue /></SelectTrigger><SelectContent>{(['Award', 'Medal', 'Trophy', 'Star', 'Heart', 'HandHeart', 'Flame', 'Crown', 'CalendarHeart', 'UsersRound', 'Footprints', 'Leaf', 'Rocket', 'Megaphone'] as const).map(icon => <SelectItem key={icon} value={icon}><span className="flex items-center gap-2"><GwIcon name={icon} />{t(`admin.lib.icons.${icon}`)}</span></SelectItem>)}</SelectContent></Select></div>
          <div className="form-field"><label className="field-label" htmlFor="lib-tier">{t('admin.lib.f.tier')}</label><select id="lib-tier" className="field-input" value={f['tier']} onChange={set('tier')}>{['bronze', 'silver', 'gold'].map(x => <option key={x} value={x}>{t(`admin.lib.tier.${x}`)}</option>)}</select></div></div></>}
      {kind === 'challenge_type' && <>{pair(input('title_en', `${t('admin.lib.f.title')} · EN`), input('title_es', `${t('admin.lib.f.title')} · ES`))}{pair(area('description_en', `${t('admin.lib.f.description')} · EN`), area('description_es', `${t('admin.lib.f.description')} · ES`))}
        {pair(input('daily_prompt_en', `${t('admin.lib.f.prompt')} · EN`), input('daily_prompt_es', `${t('admin.lib.f.prompt')} · ES`))}{input('days', t('admin.lib.f.days'), 'number')}</>}
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
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="bc-ten">{t('admin.bc.titleField')} · EN</label><Input id="bc-ten" maxLength={120} className="field-input" value={f.title_en} onChange={set('title_en')} /></div><div className="form-field"><label className="field-label" htmlFor="bc-tes">{t('admin.bc.titleField')} · ES</label><Input id="bc-tes" maxLength={120} className="field-input" value={f.title_es} onChange={set('title_es')} /></div></div>
        <div className="bilingual"><div className="form-field"><label className="field-label" htmlFor="bc-ben">{t('admin.bc.body')} · EN</label><Textarea id="bc-ben" rows={4} maxLength={2000} className="field-textarea" value={f.body_en} onChange={set('body_en')} /></div><div className="form-field"><label className="field-label" htmlFor="bc-bes">{t('admin.bc.body')} · ES</label><Textarea id="bc-bes" rows={4} maxLength={2000} className="field-textarea" value={f.body_es} onChange={set('body_es')} /></div></div>
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
        {b.active ? <Button variant="secondary" size="sm" onClick={async () => { await end({ data: { id: b.id } }); await qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] }); }}>{t('admin.bc.end')}</Button> : <span className="chip">{t('admin.bc.ended')}</span>}
      </li>)}{!data?.list.length && <li className="muted-copy">{t('admin.empty')}</li>}</ul>
    </section>
  </>;
}

function Settings() {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient();
  const fn = useServerFn(getFlags); const save = useServerFn(setFlag);
  const { data = [] } = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => fn() });
  const update = async (key: string, enabled: boolean, value: string | null) => {
    const r = await save({ data: { key, enabled, value } });
    if (!r.ok) toast.error(t('admin.errors.failed')); else { toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); await qc.invalidateQueries({ queryKey: ['feature-flags'] }); }
  };
  return <>
    <section className="panel"><Link to="/admin/site-media" className="settings-row"><GwIcon name="ImageDown" className="settings-icon" /><span className="settings-label">{t('siteMedia.menu')}</span><GwIcon name="ChevronRight" className="settings-chevron" /></Link></section>
    <section className="panel"><h2 className="section-title">{t('admin.flags.title')}</h2>
      <ul className="admin-list">{data.map(fl => <li key={fl.key} className="admin-row flag-row">
        <span className="admin-row-main"><strong>{t(`admin.flags.name.${fl.key}`, { defaultValue: fl.key })}</strong><small>{lang === 'es' ? fl.description_es : fl.description_en}</small></span>
        {fl.key === 'landing_headline' && <select aria-label={t('admin.flags.variant')} className="field-input flag-select" value={fl.value ?? 'A'} onChange={e => update(fl.key, fl.enabled, e.target.value)}>{['A', 'B', 'C', 'D'].map(v => <option key={v} value={v}>{t('admin.flags.headline', { v })}</option>)}</select>}
        <Switch checked={fl.enabled} onCheckedChange={v => update(fl.key, v, fl.value)} aria-label={t(`admin.flags.name.${fl.key}`, { defaultValue: fl.key })} />
      </li>)}</ul>
    </section>
  </>;
}

const AREAS = ['all', 'team', 'user', 'moderation', 'library', 'broadcast', 'flag'] as const;
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
