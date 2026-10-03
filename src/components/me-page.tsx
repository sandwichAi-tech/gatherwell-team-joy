import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CalendarDays, Flag, Award, UsersRound, Bell, CreditCard, Globe2, Sun, Moon, Monitor, LifeBuoy, FileText, ShieldCheck,
  LogOut, ChevronRight, Camera, Upload, Check, ExternalLink, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { useSwitchTeam } from '@/components/team-switcher';
import { setLanguage } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf, mediaUrl, profileQuery, teamsQuery, uploadMedia, workspaceQuery } from '@/lib/account';

const HTTPS_URL = /^https:\/\/[^\s/]+\.[^\s]+$/i;

function Avatar({ path, name, size = 64, preview }: { path?: string | null | undefined; name?: string | null | undefined; size?: number; preview?: string | null | undefined }) {
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

  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('profile.editTitle')}>
    <div className="edit-form">
      <div className="photo-row">
        <Avatar path={removePhoto ? null : profile?.avatar_url} name={form.full_name} preview={preview} />
        <label className="file-button"><Upload />{t('onboarding.upload')}<input type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} /></label>
        <label className="file-button"><Camera />{t('onboarding.camera')}<input type="file" accept="image/*" capture="user" hidden onChange={e => pick(e.target.files?.[0])} /></label>
        {(preview || (profile?.avatar_url && !removePhoto)) && <button type="button" className="auth-link" onClick={() => { setFile(null); setPreview(null); setRemovePhoto(true); }}>{t('onboarding.removePhoto')}</button>}
      </div>
      {errors.photo && <p className="field-error">{errors.photo}</p>}
      {field('full_name', t('onboarding.nameLabel'), { autoComplete: 'name', maxLength: 80 })}
      <div className="form-field">
        <div className="label-row"><label className="field-label" htmlFor="edit-bio">{t('profile.bio')}</label><span className={`char-count ${form.bio.length > 160 ? 'is-over' : ''}`}>{form.bio.length}/160</span></div>
        <Textarea id="edit-bio" rows={3} className="field-textarea" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value.slice(0, 200) })} placeholder={t('profile.bioPlaceholder')} />
        {errors.bio && <p className="field-error">{errors.bio}</p>}
      </div>
      {field('city', t('onboarding.city'), { autoComplete: 'address-level2', maxLength: 80 })}
      {field('phone', t('profile.phone'), { type: 'tel', autoComplete: 'tel', maxLength: 30 })}
      <div className="form-field"><span className="field-label">{t('me.language')}</span>
        <div className="choice-pair">{(['en', 'es'] as const).map(lang => <button key={lang} type="button" className={`choice-card ${form.language === lang ? 'is-selected' : ''}`} aria-pressed={form.language === lang} onClick={() => setForm({ ...form, language: lang })}><strong>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</strong></button>)}</div>
      </div>
      {field('shop_url', t('profile.shop'), { type: 'url', inputMode: 'url', placeholder: 'https://', maxLength: 300 })}
      <Button className="onboarding-continue" disabled={busy} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
    </div>
  </ResponsiveSheet>;
}

type Panel = 'gatherings' | 'challenges' | 'badges' | 'teams' | 'notifications' | 'plan' | null;

export function MePage() {
  const { t, i18n } = useTranslation();
  const { userId, theme, setTheme } = useGatherwell();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const switchTeam = useSwitchTeam(userId);
  const saveLanguage = useLanguageSaver(userId);
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [soleTeams, setSoleTeams] = useState<string[] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const row = (Icon: typeof CalendarDays, label: string, onClick?: () => void, trailing?: ReactNode, extra = '') => <button type="button" className={`settings-row ${extra}`} onClick={onClick}><Icon className="settings-icon" /><span className="settings-label">{label}</span>{trailing ?? <ChevronRight className="settings-chevron" />}</button>;

  const panels: Record<Exclude<Panel, null>, { title: string; body: ReactNode }> = {
    gatherings: { title: t('profile.myGatherings'), body: <p className="auth-subtitle">{t('profile.gatheringsEmpty')}</p> },
    challenges: { title: t('profile.myChallenges'), body: <p className="auth-subtitle">{t('profile.challengesEmpty')}</p> },
    badges: { title: t('profile.myBadges'), body: <><span className="chip sample-badge">{t('common.sample')}</span><div className="badge-grid">{(['first', 'streak', 'host'] as const).map(key => <div className="badge-card" key={key}><span className="badge-icon"><Award /></span><strong>{t(`profile.badges.${key}`)}</strong><small>{t(`profile.badges.${key}Text`)}</small></div>)}</div></> },
    teams: { title: t('profile.myTeams'), body: teams.length ? <div className="team-list">{teams.map(team => <button type="button" key={team.teamId} className={`choice-card ${workspace?.teamId === team.teamId ? 'is-selected' : ''}`} aria-pressed={workspace?.teamId === team.teamId} onClick={() => switchTeam(team.teamId)}><span className="initial-avatar">{initialsOf(team.name)}</span><span><strong>{team.name}</strong><small>{t(`roles.${team.role}`)}{team.customBadge ? ` · ${team.customBadge}` : ''}</small></span>{workspace?.teamId === team.teamId && <Check className="choice-check" />}</button>)}</div> : <p className="auth-subtitle">{t('workspace.none')}</p> },
    notifications: { title: t('profile.notifications'), body: <p className="not-connected">{t('common.notConnected')}</p> },
    plan: { title: t('profile.plan'), body: <><p className="plan-name">{t(`plans.${workspace?.plan ?? 'free'}`)}</p><p className="auth-subtitle">{workspace?.name ?? t('workspace.none')}</p></> },
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('me.eyebrow')}</span><h1>{t('me.title')}</h1></div></div>

    <section className="panel profile-header">
      <Avatar path={profile?.avatar_url} name={profile?.full_name} size={72} />
      <div className="profile-meta">
        <h2>{profile?.full_name}</h2>
        {profile?.city && <p>{profile.city}</p>}
        {workspace && <div className="profile-chips"><span className="profile-team">{workspace.name}</span><span className="chip">{t(`roles.${workspace.role}`)}</span>{workspace.customBadge && <span className="chip warm-chip">{workspace.customBadge}</span>}</div>}
        {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
        {profile?.shop_url && <a className="auth-link shop-link" href={profile.shop_url} target="_blank" rel="noopener noreferrer">{t('profile.shop')}<ExternalLink /></a>}
      </div>
      <Button variant="secondary" className="profile-edit" onClick={() => setEditing(true)}><Pencil />{t('profile.edit')}</Button>
    </section>

    <section className="panel settings-list">
      {row(CalendarDays, t('profile.myGatherings'), () => setPanel('gatherings'))}
      {row(Flag, t('profile.myChallenges'), () => setPanel('challenges'))}
      {row(Award, t('profile.myBadges'), () => setPanel('badges'))}
      {row(UsersRound, t('profile.myTeams'), () => setPanel('teams'), <span className="settings-value">{workspace?.name}<ChevronRight className="settings-chevron" /></span>)}
      {row(Bell, t('profile.notifications'), () => setPanel('notifications'))}
      {row(CreditCard, t('profile.plan'), () => setPanel('plan'), <span className="settings-value">{t(`plans.${workspace?.plan ?? 'free'}`)}<ChevronRight className="settings-chevron" /></span>)}
      <div className="settings-row is-static"><Globe2 className="settings-icon" /><span className="settings-label">{t('me.language')}</span>
        <div className="segmented" role="group" aria-label={t('me.language')}>{(['en', 'es'] as const).map(lang => <Button key={lang} variant="ghost" aria-pressed={i18n.resolvedLanguage === lang} className={i18n.resolvedLanguage === lang ? 'selected' : ''} onClick={() => saveLanguage(lang)}>{lang === 'en' ? 'EN' : 'ES'}</Button>)}</div></div>
      <div className="settings-row is-static"><Sun className="settings-icon" /><span className="settings-label">{t('me.appearance')}</span>
        <div className="segmented" role="group" aria-label={t('me.appearance')}>{([{ value: 'light', Icon: Sun }, { value: 'dark', Icon: Moon }, { value: 'system', Icon: Monitor }] as const).map(({ value, Icon }) => <Button key={value} variant="ghost" size="icon" className={theme === value ? 'selected' : ''} aria-pressed={theme === value} aria-label={t(`me.${value}`)} title={t(`me.${value}`)} onClick={() => setTheme(value)}><Icon /></Button>)}</div></div>
      <a className="settings-row" href="mailto:help@gatherwell.app"><LifeBuoy className="settings-icon" /><span className="settings-label">{t('profile.help')}</span><ChevronRight className="settings-chevron" /></a>
      <Link className="settings-row" to="/terms"><FileText className="settings-icon" /><span className="settings-label">{t('auth.terms')}</span><ChevronRight className="settings-chevron" /></Link>
      <Link className="settings-row" to="/privacy"><ShieldCheck className="settings-icon" /><span className="settings-label">{t('auth.privacy')}</span><ChevronRight className="settings-chevron" /></Link>
      {row(LogOut, t('me.signOut'), signOut, <span />)}
    </section>

    <button type="button" className="delete-account" onClick={openDelete}>{t('profile.delete')}</button>

    <EditProfile open={editing} onOpenChange={setEditing} userId={userId} />
    <ResponsiveSheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }} title={panel ? panels[panel].title : ''}>{panel && panels[panel].body}</ResponsiveSheet>
    <ResponsiveSheet open={deleting} onOpenChange={setDeleting} title={t('profile.deleteTitle')}>
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
