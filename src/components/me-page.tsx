import { CalendarFeedPanel } from '@/components/follow';
import { EmptyState } from '@/components/launch-states';
import { planStatusQuery } from '@/lib/billing';
import { AssistantUsage } from '@/components/assistant/assistant-usage';
import { isAdminQuery } from '@/lib/site-media';
import { NotificationSettings } from '@/components/notifications';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CalendarDays, Flag, Award, UsersRound, Bell, CreditCard, Globe2, Sun, Moon, Monitor, LifeBuoy, FileText, ShieldCheck,
  LogOut, ChevronRight, UserPlus, Camera, Upload, Check, ExternalLink, Pencil,
  ImageDown,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { useSwitchTeam } from '@/components/team-switcher';
import { setLanguage } from '@/components/auth-frame';
import { BadgeWall, RecognitionSummary, useHostOfMonthId } from '@/components/recognition';
import { supabase } from '@/integrations/supabase/client';
import { PurchasesPanel } from '@/components/offers';
import { InviteFriendsPanel } from '@/components/welcome';
import { MyChallengesList, MyGatheringsList, ProfileHero, RecentBadges, SettingsGroup, StatsStrip } from '@/components/profile-hero';
import { GwFeatureTile, type GwIconName } from '@/components/gw-icon';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, QrCode, Trash2 } from '@/components/icons';
import { initialsOf, mediaUrl, profileQuery, teamsQuery, uploadMedia, workspaceQuery } from '@/lib/account';

const HTTPS_URL = /^https:\/\/[^\s/]+\.[^\s]+$/i;

export function Avatar({ path, name, size = 64, preview }: { path?: string | null | undefined; name?: string | null | undefined; size?: number; preview?: string | null | undefined }) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path && !preview, staleTime: 50 * 60 * 1000 });
  const src = preview ?? url;
  return src ? <img src={src} alt="" className="profile-avatar" style={{ width: size, height: size }} /> : <span className="initial-avatar profile-avatar" style={{ width: size, height: size, fontSize: size / 3.2 }}>{initialsOf(name)}</span>;
}

function useLanguageSaver(userId: string) {
  const queryClient = useQueryClient();
  return async (lang: 'en' | 'es') => {
    setLanguage(lang);
    await supabase.from('profiles').update({ language: lang }).eq('id', userId);
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  };
}

function EditProfile({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const saveLanguage = useLanguageSaver(userId);
  const { data: profile } = useQuery(profileQuery(userId));
  const [form, setForm] = useState({ full_name: '', bio: '', city: '', phone: '', language: 'en' as 'en' | 'es', shop_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'full_name' | 'bio' | 'city' | 'phone' | 'shop_url' | 'photo', string>>>({});

  useEffect(() => {
    if (!open || !profile) return;
    setForm({ full_name: profile.full_name ?? '', bio: profile.bio ?? '', city: profile.city ?? '', phone: profile.phone ?? '', language: profile.language === 'es' ? 'es' : 'en', shop_url: profile.shop_url ?? '' });
    setFile(null); setPreview(null); setRemovePhoto(false); setErrors({});
  }, [open, profile]);

  const pick = (f?: File) => { if (!f) return; if (f.size > 5 * 1024 * 1024) { setErrors({ photo: t('profile.photoTooLarge') }); return; } setFile(f); setPreview(URL.createObjectURL(f)); setRemovePhoto(false); };

  const save = async () => {
    const next: Partial<Record<'full_name' | 'bio' | 'city' | 'phone' | 'shop_url' | 'photo', string>> = {};
    if (form.full_name.trim().length < 2) next.full_name = t('profile.nameRequired');
    if (form.bio.length > 160) next.bio = t('profile.bioTooLong');
    if (form.shop_url.trim() && !HTTPS_URL.test(form.shop_url.trim())) next.shop_url = t('profile.shopInvalid');
    if (form.phone.trim() && !/^[+\d][\d\s().-]{5,24}$/.test(form.phone.trim())) next.phone = t('profile.phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      let avatar_url = profile?.avatar_url ?? null;
      if (file) avatar_url = await uploadMedia(userId, file, 'avatar');
      else if (removePhoto) avatar_url = null;
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(), bio: form.bio.trim() || null, city: form.city.trim() || null,
        phone: form.phone.trim() || null, language: form.language, shop_url: form.shop_url.trim() || null, avatar_url,
      }).eq('id', userId);
      if (error) throw error;
      if (form.language !== profile?.language) await saveLanguage(form.language);
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      toast.success(t('profile.saved'));
      onOpenChange(false);
    } catch { toast.error(t('profile.saveError')); }
    setBusy(false);
  };

  const field = (key: 'full_name' | 'city' | 'phone' | 'shop_url', label: string, props: Record<string, unknown> = {}) => <div className="form-field">
    <label className="field-label" htmlFor={`edit-${key}`}>{label}</label>
    <Input id={`edit-${key}`} className="field-input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} aria-invalid={!!errors[key]} {...props} />
    {errors[key] && <p className="field-error">{errors[key]}</p>}
  </div>;

  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('profile.editTitle')} icon="Pencil"
    footer={<Button className="sheet-primary" disabled={busy} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>}>
    <div className="edit-form">
      <div className="edit-preview">
        <div className="gw-hero-cover" aria-hidden="true" />
        <div className="edit-preview-avatar"><Avatar path={removePhoto ? null : profile?.avatar_url} name={form.full_name} preview={preview} size={88} /></div>
        <div className="photo-row flex-wrap">
          <label className="file-button"><Upload />{t('onboarding.upload')}<input type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} /></label>
          <label className="file-button"><Camera />{t('onboarding.camera')}<input type="file" accept="image/*" capture="user" hidden onChange={e => pick(e.target.files?.[0])} /></label>
          {(preview || (profile?.avatar_url && !removePhoto)) && <button type="button" className="auth-link" onClick={() => { setFile(null); setPreview(null); setRemovePhoto(true); }}>{t('onboarding.removePhoto')}</button>}
        </div>
        {errors.photo && <p className="field-error">{errors.photo}</p>}
      </div>
      <fieldset className="edit-section"><legend>{t('profile.sectionAbout')}</legend>
        {field('full_name', t('onboarding.nameLabel'), { autoComplete: 'name', maxLength: 80 })}
        <div className="form-field">
          <div className="label-row"><label className="field-label" htmlFor="edit-bio">{t('profile.bio')}</label><span className={`char-count ${form.bio.length > 160 ? 'is-over' : ''}`}>{form.bio.length}/160</span></div>
          <Textarea id="edit-bio" rows={3} className="field-textarea" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value.slice(0, 200) })} placeholder={t('profile.bioPlaceholder')} />
          {errors.bio && <p className="field-error">{errors.bio}</p>}
        </div>
        {field('city', t('onboarding.city'), { autoComplete: 'address-level2', maxLength: 80 })}
      </fieldset>
      <fieldset className="edit-section"><legend>{t('profile.sectionContact')}</legend>
        {field('phone', t('profile.phone'), { type: 'tel', autoComplete: 'tel', maxLength: 30 })}
        {field('shop_url', t('profile.shop'), { type: 'url', inputMode: 'url', placeholder: 'https://', maxLength: 300 })}
      </fieldset>
      <fieldset className="edit-section"><legend>{t('me.language')}</legend>
        <div className="choice-pair">{(['en', 'es'] as const).map(lang => <button key={lang} type="button" className={`choice-card ${form.language === lang ? 'is-selected' : ''}`} aria-pressed={form.language === lang} onClick={() => setForm({ ...form, language: lang })}><strong>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</strong></button>)}</div>
      </fieldset>
    </div>
  </ResponsiveSheet>;
}

type Panel = 'qr' | 'gatherings' | 'challenges' | 'badges' | 'teams' | 'notifications' | 'plan' | 'purchases' | 'invite' | 'calendar' | null;

export function MePage() {
  const { t, i18n } = useTranslation();
  const { userId, theme, setTheme } = useGatherwell();
  const { data: isAdmin } = useQuery(isAdminQuery(userId));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const { data: planStatus } = useQuery(planStatusQuery(userId));
  const homId = useHostOfMonthId(workspace?.teamId);
  const switchTeam = useSwitchTeam(userId);
  const saveLanguage = useLanguageSaver(userId);
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [soleTeams, setSoleTeams] = useState<string[] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { data: inviteUrl } = useQuery({ queryKey: ['my-invite-url', userId], enabled: panel === 'qr', queryFn: async () => { const { data } = await supabase.rpc('my_invite_code'); return data ? `${window.location.origin}/i/${data}` : null; } });

  const signOut = async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); void navigate({ to: '/login', replace: true }); };

  const openDelete = async () => {
    setConfirmText(''); setDeleting(true); setSoleTeams(null);
    const { data } = await supabase.rpc('my_sole_leader_teams');
    setSoleTeams((data ?? []).map(row => row.team_name));
  };
  const deleteAccount = async () => {
    setDeleteBusy(true);
    const { error } = await supabase.rpc('delete_my_account');
    setDeleteBusy(false);
    if (error) { toast.error(error.message.includes('sole_leader') ? t('profile.deleteBlocked') : t('profile.saveError')); return; }
    await signOut();
  };

  const row = (icon: GwIconName, label: string, onClick?: () => void, trailing?: ReactNode, extra = '') => <button type="button" className={`settings-row ${extra}`} onClick={onClick}><GwFeatureTile name={icon} size={24} className="settings-tile" /><span className="settings-label">{label}</span>{trailing ?? <ChevronRight className="settings-chevron" />}</button>;
  const linkRow = (icon: GwIconName, label: string, to: string, trailing?: ReactNode, search?: Record<string, string>) => <Link className="settings-row" to={to} search={search as never}><GwFeatureTile name={icon} size={24} className="settings-tile" /><span className="settings-label">{label}</span>{trailing ?? <ChevronRight className="settings-chevron" />}</Link>;
  const staticRow = (icon: GwIconName, label: string, control: ReactNode) => <div className="settings-row is-static"><GwFeatureTile name={icon} size={24} className="settings-tile" /><span className="settings-label">{label}</span>{control}</div>;

  const panelIcons: Record<Exclude<Panel, null>, GwIconName> = { qr: 'QrCode', gatherings: 'CalendarDays', challenges: 'Flag', badges: 'Award', teams: 'UsersRound', notifications: 'Bell', plan: 'CreditCard', purchases: 'CreditCard', invite: 'UserPlus', calendar: 'CalendarPlus' };
  const panels: Record<Exclude<Panel, null>, { title: string; icon: GwIconName; body: ReactNode }> = {
    gatherings: { title: t('profile.myGatherings'), icon: 'CalendarDays', body: <MyGatheringsList userId={userId} /> },
    challenges: { title: t('profile.myChallenges'), icon: 'Flag', body: <MyChallengesList userId={userId} /> },
    badges: { title: t('profile.myBadges'), icon: 'Award', body: workspace ? <BadgeWall teamId={workspace.teamId} /> : <EmptyState compact icon="UsersRound" text={t('workspace.none')} /> },
    teams: { title: t('profile.myTeams'), icon: 'UsersRound', body: teams.length ? <div className="team-list">{teams.map(team => <button type="button" key={team.teamId} className={`choice-card ${workspace?.teamId === team.teamId ? 'is-selected' : ''}`} aria-pressed={workspace?.teamId === team.teamId} onClick={() => switchTeam(team.teamId)}><span className="initial-avatar">{initialsOf(team.name)}</span><span><strong>{team.name}</strong><small>{t(`roles.${team.role}`)}{team.customBadge ? ` · ${team.customBadge}` : ''}</small></span>{workspace?.teamId === team.teamId && <Check className="choice-check" />}</button>)}</div> : <EmptyState compact icon="UsersRound" text={t('workspace.none')} /> },
    notifications: { title: t('profile.notifications'), icon: 'Bell', body: <NotificationSettings userId={userId} /> },
    invite: { title: t('welcome.title'), icon: 'UserPlus', body: <InviteFriendsPanel /> },
    calendar: { title: t('follow.feedTitle'), icon: 'CalendarPlus', body: <CalendarFeedPanel userId={userId} /> },
    purchases: { title: t('offers.purchases'), icon: 'CreditCard', body: <PurchasesPanel /> },
    qr: { title: t('profile.qrTitle'), icon: 'QrCode', body: <div className="qr-panel">{inviteUrl ? <div className="qr-code"><QRCodeSVG value={inviteUrl} size={280} level="M" marginSize={2} /></div> : <p className="auth-subtitle">{t('publicEvent.loading')}</p>}<p className="auth-subtitle">{t('profile.qrText')}</p></div> },
    plan: { title: t('profile.plan'), icon: 'CreditCard', body: <><p className="plan-name">{t(`plans.${workspace?.plan ?? 'free'}`)}</p><p className="auth-subtitle">{workspace?.name ?? t('workspace.none')}</p></> },
  };

  const isHost = !!workspace && workspace.role !== 'member';
  return <>
    <h1 className="sr-only">{t('me.title')}</h1>
    <ProfileHero
      avatar={<span className={homId === userId ? 'hom-ring hom-wrap' : 'hom-wrap'}><Avatar path={profile?.avatar_url} name={profile?.full_name} size={96} /></span>}
      name={profile?.full_name} city={profile?.city} team={workspace?.name} role={workspace ? t(`roles.${workspace.role}`) : null} badge={workspace?.customBadge} bio={profile?.bio}
      actions={<>
        <Button variant="secondary" className="gw-hero-edit" onClick={() => setEditing(true)}><Pencil />{t('profile.edit')}</Button>
        <Button variant="secondary" size="icon" className="gw-hero-icon" aria-label={t('profile.share')} title={t('profile.share')} onClick={() => setPanel('invite')}><Share2 /></Button>
        <Button variant="secondary" size="icon" className="gw-hero-icon" aria-label={t('profile.qrTitle')} title={t('profile.qrTitle')} onClick={() => setPanel('qr')}><QrCode /></Button>
      </>}
    />
    {profile?.shop_url && <a className="auth-link shop-link" href={profile.shop_url} target="_blank" rel="noopener noreferrer">{t('profile.shop')}<ExternalLink /></a>}
    <StatsStrip userId={userId} teamId={workspace?.teamId} />
    <RecentBadges userId={userId} teamId={workspace?.teamId} onAll={workspace ? () => setPanel('badges') : undefined} />
    {workspace && <section className="panel recognition-panel"><div className="section-heading"><h2>{t('recognition.title')}</h2></div><RecognitionSummary teamId={workspace.teamId} /></section>}

    {planStatus?.status === 'past_due' && <Link to="/plan" className="plan-banner" role="alert">{t('billing.pastDue')}</Link>}
    <AssistantUsage />

    <SettingsGroup title={t('profile.groupAccount')}>
      {row('UsersRound', t('profile.myTeams'), () => setPanel('teams'), <span className="settings-value">{workspace?.name}<ChevronRight className="settings-chevron" /></span>)}
      {linkRow('CreditCard', t('profile.plan'), '/plan', <span className="settings-value">{t(`billing.plan_${planStatus?.plan ?? 'free'}`)}<ChevronRight className="settings-chevron" /></span>)}
      {row('CreditCard', t('offers.purchases'), () => setPanel('purchases'))}
    </SettingsGroup>
    <SettingsGroup title={t('profile.groupActivity')}>
      {row('CalendarDays', t('profile.myGatherings'), () => setPanel('gatherings'))}
      {row('Flag', t('profile.myChallenges'), () => setPanel('challenges'))}
      {row('Award', t('profile.myBadges'), () => setPanel('badges'))}
      {row('UserPlus', t('welcome.title'), () => setPanel('invite'))}
      {row('CalendarPlus', t('follow.feedTitle'), () => setPanel('calendar'))}
    </SettingsGroup>
    <SettingsGroup title={t('profile.groupPreferences')}>
      {row('Bell', t('profile.notifications'), () => setPanel('notifications'))}
      {staticRow('Globe2', t('me.language'), <div className="segmented" role="group" aria-label={t('me.language')}>{(['en', 'es'] as const).map(lang => <Button key={lang} variant="ghost" aria-pressed={i18n.resolvedLanguage === lang} className={i18n.resolvedLanguage === lang ? 'selected' : ''} onClick={() => saveLanguage(lang)}>{lang === 'en' ? 'EN' : 'ES'}</Button>)}</div>)}
      {staticRow('Sun', t('me.appearance'), <div className="segmented" role="group" aria-label={t('me.appearance')}>{([{ value: 'light', Icon: Sun }, { value: 'dark', Icon: Moon }, { value: 'system', Icon: Monitor }] as const).map(({ value, Icon }) => <Button key={value} variant="ghost" size="icon" className={theme === value ? 'selected' : ''} aria-pressed={theme === value} aria-label={t(`me.${value}`)} title={t(`me.${value}`)} onClick={() => setTheme(value)}><Icon /></Button>)}</div>)}
    </SettingsGroup>
    {(isHost || isAdmin) && <SettingsGroup title={t('profile.groupHost')}>
      {isHost && linkRow('FileText', t('offers.title'), '/offers')}
      {isAdmin && linkRow('ShieldCheck', t('admin.menu'), '/admin', undefined, { tab: 'overview' })}
      {isAdmin && linkRow('ImageDown', t('siteMedia.menu'), '/admin/site-media')}
    </SettingsGroup>}
    <SettingsGroup title={t('profile.groupSupport')}>
      <a className="settings-row" href="mailto:help@gatherwell.app"><GwFeatureTile name="LifeBuoy" size={24} className="settings-tile" /><span className="settings-label">{t('profile.help')}</span><ChevronRight className="settings-chevron" /></a>
      {row('LogOut', t('me.signOut'), signOut, <span />)}
    </SettingsGroup>
    <SettingsGroup title={t('profile.groupLegal')}>
      {linkRow('FileText', t('auth.terms'), '/terms')}
      {linkRow('ShieldCheck', t('auth.privacy'), '/privacy')}
      {(['host', 'guest', 'sms', 'cookies'] as const).map(d => <Link key={d} className="settings-row" to="/legal/$doc" params={{ doc: d }}><GwFeatureTile name="FileText" size={24} className="settings-tile" /><span className="settings-label">{t(`legalDocs.docs.${d}.title`)}</span><ChevronRight className="settings-chevron" /></Link>)}
    </SettingsGroup>
    <SettingsGroup danger>
      <button type="button" className="settings-row is-danger" onClick={openDelete}><span className="gw-feature-tile settings-tile is-danger"><Trash2 /></span><span className="settings-label">{t('profile.delete')}</span></button>
    </SettingsGroup>

    <EditProfile open={editing} onOpenChange={setEditing} userId={userId} />
    <ResponsiveSheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }} title={panel ? panels[panel].title : ''} icon={panel ? panelIcons[panel] : 'UserRound'}>{panel && panels[panel].body}</ResponsiveSheet>
    <ResponsiveSheet open={deleting} onOpenChange={setDeleting} title={t('profile.deleteTitle')} icon="Trash2">
      {soleTeams === null ? <p className="auth-subtitle">{t('publicEvent.loading')}</p> : soleTeams.length ? <>
        <p className="auth-subtitle">{t('profile.deleteBlockedText', { teams: soleTeams.join(', ') })}</p>
        <Button variant="secondary" onClick={() => setDeleting(false)}>{t('common.close')}</Button>
      </> : <div className="edit-form">
        <p className="auth-subtitle">{t('profile.deleteText')}</p>
        <label className="field-label" htmlFor="delete-confirm">{t('profile.deleteType')}</label>
        <Input id="delete-confirm" className="field-input" autoComplete="off" value={confirmText} onChange={e => setConfirmText(e.target.value)} />
        <Button variant="destructive" className="onboarding-continue" disabled={confirmText !== 'DELETE' || deleteBusy} onClick={deleteAccount}>{t('profile.deleteConfirm')}</Button>
      </div>}
    </ResponsiveSheet>
  </>;
}
