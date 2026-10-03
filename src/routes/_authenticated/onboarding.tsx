import { useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, Upload, Crown, CalendarHeart, UsersRound, Check, Copy, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageToggle, pageHead, setLanguage } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';
import { JOIN_CODE_KEY, initialsOf, joinLink, parseJoinCode, profileQuery, uploadMedia, workspaceQuery } from '@/lib/account';

export const Route = createFileRoute('/_authenticated/onboarding')({ head: () => pageHead('onboarding.nameTitle', 'meta.onboarding'), component: Onboarding });

type Step = 'name' | 'place' | 'role' | 'team';
type Role = 'leader' | 'host' | 'member';

function Onboarding() {
  const { t, i18n } = useTranslation();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [joined, setJoined] = useState<{ team: string; leader: string | null } | null>(null);
  const [created, setCreated] = useState<{ team: string; joinCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    void (async () => {
      const profile = await queryClient.fetchQuery(profileQuery(user.id));
      const workspace = await queryClient.fetchQuery(workspaceQuery(user.id));
      const pending = localStorage.getItem(JOIN_CODE_KEY);
      if (profile?.onboarded && !pending) { void navigate({ to: '/', replace: true }); return; }
      let joinedTeam: { team: string; leader: string | null } | null = null;
      if (pending) {
        const { data: invite } = await supabase.rpc('get_team_invite', { _code: pending });
        const { error: joinError } = await supabase.rpc('join_team_by_code', { _code: pending, _role: profile?.role_intent === 'host' ? 'host' : 'member' });
        localStorage.removeItem(JOIN_CODE_KEY);
        if (!joinError && invite?.[0]) joinedTeam = { team: invite[0].team_name, leader: invite[0].leader_name };
        await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] });
      }
      setName(profile?.full_name ?? '');
      setCity(profile?.city ?? '');
      setRole((profile?.role_intent as Role | null) ?? null);
      const list: Step[] = [];
      if (!profile?.full_name) list.push('name');
      if (!profile?.city) list.push('place');
      if (!profile?.role_intent) list.push('role');
      if (!workspace && !joinedTeam) list.push('team');
      setJoined(joinedTeam);
      setSteps(list);
      if (!list.length && !joinedTeam) await finish();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    await queryClient.invalidateQueries();
    void navigate({ to: '/', replace: true });
  }

  const pickPhoto = (file?: File) => {
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const step = steps?.[index];
  const total = steps?.length ?? 0;
  const atEnd = !!steps && index >= total;
  const canContinue = step === 'name' ? name.trim().length > 1 : step === 'place' ? city.trim().length > 0 : step === 'role' ? !!role : step === 'team' ? (role === 'leader' ? teamName.trim().length > 0 : parseJoinCode(code).length >= 6) : true;

  const next = async () => {
    if (!step || !canContinue) return;
    setBusy(true); setError(null);
    try {
      if (step === 'name') {
        const update: { full_name: string; avatar_url?: string } = { full_name: name.trim() };
        if (photo) update.avatar_url = await uploadMedia(user.id, photo, 'avatar');
        const { error: e } = await supabase.from('profiles').update(update).eq('id', user.id); if (e) throw e;
      } else if (step === 'place') {
        const { error: e } = await supabase.from('profiles').update({ city: city.trim(), language: i18n.resolvedLanguage === 'es' ? 'es' : 'en' }).eq('id', user.id); if (e) throw e;
      } else if (step === 'role' && role) {
        const { error: e } = await supabase.from('profiles').update({ role_intent: role }).eq('id', user.id); if (e) throw e;
      } else if (step === 'team') {
        if (role === 'leader') {
          const { data, error: e } = await supabase.rpc('create_team', { _name: teamName.trim() }); if (e || !data?.[0]) throw e;
          if (cover) { const path = await uploadMedia(user.id, cover, 'cover'); await supabase.from('teams').update({ cover_url: path }).eq('id', data[0].id); }
          await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] });
          setCreated({ team: teamName.trim(), joinCode: data[0].join_code });
        } else {
          const clean = parseJoinCode(code);
          const { data: invite } = await supabase.rpc('get_team_invite', { _code: clean });
          if (!invite?.[0]) { setError(t('onboarding.invalidCode')); setBusy(false); return; }
          const { error: e } = await supabase.rpc('join_team_by_code', { _code: clean, _role: role === 'host' ? 'host' : 'member' }); if (e) throw e;
          await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] });
          setJoined({ team: invite[0].team_name, leader: invite[0].leader_name });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      const nextIndex = index + 1;
      setIndex(nextIndex);
      if (nextIndex >= total && step !== 'team' && !joined) await finish();
    } catch {
      setError(t('onboarding.error'));
    }
    setBusy(false);
  };

  const copy = async (link: string) => { await navigator.clipboard.writeText(link); setCopied(true); };

  const shell = (content: React.ReactNode, showBar = true) => <div className="onboarding-screen">
    {showBar && total > 0 && <div className="onboarding-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index + 1, total)} aria-label={t('onboarding.step', { current: Math.min(index + 1, total), total })}><span style={{ width: `${(Math.min(index + 1, total) / total) * 100}%` }} /></div>}
    <div className="onboarding-top">{index > 0 && !atEnd ? <button type="button" className="auth-link" onClick={() => { setError(null); setIndex(index - 1); }}>{t('onboarding.back')}</button> : <span />}<LanguageToggle /></div>
    <main className="onboarding-body">{content}</main>
  </div>;

  if (!steps) return shell(<p className="auth-subtitle">{t('onboarding.saving')}</p>, false);

  if (atEnd && created) return shell(<>
    <div className="auth-icon"><Check /></div>
    <h1 className="onboarding-title">{t('onboarding.createdTitle')}</h1>
    <p className="auth-subtitle">{t('onboarding.createdText', { team: created.team })}</p>
    <div className="copy-field"><code>{joinLink(created.joinCode)}</code><Button variant="secondary" onClick={() => copy(joinLink(created.joinCode))}>{copied ? <Check /> : <Copy />}{copied ? t('onboarding.copied') : t('onboarding.copy')}</Button></div>
    <Button className="onboarding-continue" onClick={finish}>{t('onboarding.goHome')}</Button>
  </>, false);

  if (atEnd && joined) return shell(<>
    <span className="eyebrow">{joined.team}</span>
    <h1 className="onboarding-title">{t('onboarding.welcomeTitle', { team: joined.team })}</h1>
    {joined.leader && <div className="leader-line"><span className="initial-avatar">{initialsOf(joined.leader)}</span><span>{t('onboarding.welcomeLed', { name: joined.leader })}</span></div>}
    <Button className="onboarding-continue" onClick={finish}>{t('onboarding.goHome')}</Button>
  </>, false);

  if (atEnd) return shell(<p className="auth-subtitle">{t('onboarding.saving')}</p>, false);

  const roles = [{ key: 'leader', Icon: Crown }, { key: 'host', Icon: CalendarHeart }, { key: 'member', Icon: UsersRound }] as const;

  return shell(<>
    {step === 'name' && <>
      <h1 className="onboarding-title">{t('onboarding.nameTitle')}</h1>
      <label className="field-label" htmlFor="full-name">{t('onboarding.nameLabel')}</label>
      <Input id="full-name" autoFocus autoComplete="name" maxLength={80} className="field-input" placeholder={t('onboarding.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
      <span className="field-label">{t('onboarding.photo')}</span>
      <div className="photo-row">
        {photoPreview ? <img src={photoPreview} alt="" className="photo-preview" /> : <span className="initial-avatar photo-preview">{initialsOf(name)}</span>}
        <label className="file-button"><Upload />{t('onboarding.upload')}<input type="file" accept="image/*" hidden onChange={e => pickPhoto(e.target.files?.[0])} /></label>
        <label className="file-button"><Camera />{t('onboarding.camera')}<input type="file" accept="image/*" capture="user" hidden onChange={e => pickPhoto(e.target.files?.[0])} /></label>
        {photo && <button type="button" className="auth-link" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>{t('onboarding.removePhoto')}</button>}
      </div>
    </>}
    {step === 'place' && <>
      <h1 className="onboarding-title">{t('onboarding.placeTitle')}</h1>
      <span className="field-label">{t('onboarding.language')}</span>
      <div className="choice-pair">{(['en', 'es'] as const).map(lang => <button key={lang} type="button" className={`choice-card ${i18n.resolvedLanguage === lang ? 'is-selected' : ''}`} aria-pressed={i18n.resolvedLanguage === lang} onClick={() => setLanguage(lang)}><strong>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</strong></button>)}</div>
      <label className="field-label" htmlFor="city">{t('onboarding.city')}</label>
      <Input id="city" autoComplete="address-level2" maxLength={80} className="field-input" placeholder={t('onboarding.cityPlaceholder')} value={city} onChange={e => setCity(e.target.value)} />
    </>}
    {step === 'role' && <>
      <h1 className="onboarding-title">{t('onboarding.roleTitle')}</h1>
      <div className="choice-list">{roles.map(({ key, Icon }) => <button key={key} type="button" className={`choice-card role-card ${role === key ? 'is-selected' : ''}`} aria-pressed={role === key} onClick={() => setRole(key)}><span className="creation-icon"><Icon /></span><span><strong>{t(`onboarding.${key}`)}</strong><small>{t(`onboarding.${key}Text`)}</small></span>{role === key && <Check className="choice-check" />}</button>)}</div>
    </>}
    {step === 'team' && (role === 'leader' ? <>
      <h1 className="onboarding-title">{t('onboarding.createTitle')}</h1>
      <p className="auth-subtitle">{t('onboarding.createText')}</p>
      <label className="field-label" htmlFor="team-name">{t('onboarding.teamName')}</label>
      <Input id="team-name" maxLength={80} className="field-input" placeholder={t('onboarding.teamNamePlaceholder')} value={teamName} onChange={e => setTeamName(e.target.value)} />
      <span className="field-label">{t('onboarding.cover')}</span>
      <label className="file-button"><ImagePlus />{cover ? cover.name : t('onboarding.uploadCover')}<input type="file" accept="image/*" hidden onChange={e => setCover(e.target.files?.[0] ?? null)} /></label>
    </> : <>
      <h1 className="onboarding-title">{t('onboarding.joinTitle')}</h1>
      <p className="auth-subtitle">{t('onboarding.joinText')}</p>
      <label className="field-label" htmlFor="team-code">{t('onboarding.code')}</label>
      <Input id="team-code" autoCapitalize="characters" className="field-input" placeholder={t('onboarding.codePlaceholder')} value={code} onChange={e => setCode(e.target.value)} />
    </>)}
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button className="onboarding-continue" disabled={!canContinue || busy} onClick={next}>{busy ? t('onboarding.saving') : t('onboarding.continue')}</Button>
  </>);
}
