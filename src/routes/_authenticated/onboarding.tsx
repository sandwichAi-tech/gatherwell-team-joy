import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { requestPushMoment } from '@/components/notifications';
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, Upload, Crown, CalendarHeart, UsersRound, Check, ImagePlus, Compass } from '@/components/icons';
import { QRCodeSVG } from 'qrcode.react';
import { CopyButton, ShareButton } from '@/components/copy-button';
import { CropFileInput } from '@/components/image-crop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageToggle, pageHead, setLanguage } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';
import { JOIN_BY_KEY } from '@/lib/recognition';
import { JOIN_CODE_KEY, initialsOf, joinLink, parseJoinCode, profileQuery, uploadMedia, workspaceQuery } from '@/lib/account';

export const Route = createFileRoute('/_authenticated/onboarding')({ head: () => pageHead('onboarding.nameTitle', 'meta.onboarding'), component: Onboarding });

type Step = 'name' | 'place' | 'role' | 'team';
type Role = 'guest' | 'leader' | 'host' | 'member';

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
  const [hostJoin, setHostJoin] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [joined, setJoined] = useState<{ team: string; leader: string | null } | null>(null);
  const [created, setCreated] = useState<{ team: string; joinCode: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    void (async () => {
      const profile = await queryClient.fetchQuery(profileQuery(user.id));
      const workspace = await queryClient.fetchQuery(workspaceQuery(user.id));
      const pending = localStorage.getItem(JOIN_CODE_KEY);
      if (profile?.onboarded && !pending) { void navigate({ to: '/home', replace: true }); return; }
      let joinedTeam: { team: string; leader: string | null } | null = null;
      if (pending) {
        const { data: invite } = await supabase.rpc('get_team_invite', { _code: pending });
        const by = localStorage.getItem(JOIN_BY_KEY);
        const { error: joinError } = await supabase.rpc('join_team_by_code', { _code: pending, _role: profile?.role_intent === 'host' ? 'host' : 'member', ...(by ? { _by: by } : {}) });
        localStorage.removeItem(JOIN_CODE_KEY); localStorage.removeItem(JOIN_BY_KEY);
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
      if (!workspace && !joinedTeam && profile?.role_intent !== 'guest') list.push('team');
      setJoined(joinedTeam); if (joinedTeam) requestPushMoment('joined');
      setSteps(list);
      if (!list.length && !joinedTeam) await finish();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    if (finishing) return; setFinishing(true); setError(null);
    const { error: e } = await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    if (e) { setFinishing(false); setError(t('onboarding.error')); return; }
    trackEvent('signup'); trackEvent('onboarding_complete');
    localStorage.removeItem(JOIN_CODE_KEY);
    // Mark the cached profile onboarded so the app gate lets Home through immediately.
    queryClient.setQueryData(profileQuery(user.id).queryKey, p => (p ? { ...p, onboarded: true } : p));
    await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] }).catch(() => null);
    const dest = role === 'host' || role === 'leader' ? '/start' : '/home';
    try { await navigate({ to: dest, replace: true }); } catch { window.location.assign(dest); }
    void queryClient.invalidateQueries();
  }

  const step = steps?.[index];
  // Hosts get their own page by default; joining a team is optional.
  const creating = role === 'leader' || (role === 'host' && !hostJoin);
  const hostName = role === 'host' && !hostJoin;
  useEffect(() => { if (step === 'team' && role === 'host' && !teamName) setTeamName(name.trim()); }, [step, role, name, teamName]);
  const total = steps?.length ?? 0;
  const atEnd = !!steps && index >= total;
  const canContinue = step === 'name' ? name.trim().length > 1 : step === 'place' ? city.trim().length > 0 : step === 'role' ? !!role : step === 'team' ? (creating ? teamName.trim().length > 0 : parseJoinCode(code).length >= 6) : true;

  const next = async () => {
    if (!step || !canContinue) return;
    setBusy(true); setError(null);
    try {
      if (step === 'name') {
        const { error: e } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id); if (e) throw e;
        if (photo) {
          try {
            const avatar = await uploadMedia(user.id, photo, 'avatar');
            const { error: pe } = await supabase.from('profiles').update({ avatar_url: avatar }).eq('id', user.id); if (pe) throw pe;
          } catch (photoError) {
            console.error('Profile photo upload failed:', photoError instanceof Error ? photoError.message : photoError);
            toast(t('onboarding.photoFailed'));
          }
        }
      } else if (step === 'place') {
        const { error: e } = await supabase.from('profiles').update({ city: city.trim(), language: i18n.resolvedLanguage === 'es' ? 'es' : 'en' }).eq('id', user.id); if (e) throw e;
      } else if (step === 'role' && role) {
        const { error: e } = await supabase.from('profiles').update({ role_intent: role }).eq('id', user.id); if (e) throw e;
        if (role === 'guest') { setSteps(steps!.filter(s => s !== 'team')); await queryClient.invalidateQueries({ queryKey: ['profile', user.id] }); setBusy(false); await finish(); return; }
      } else if (step === 'team') {
        if (creating) {
          const { data, error: e } = await supabase.rpc('create_team', { _name: teamName.trim() }); if (e || !data?.[0]) throw e;
          if (cover) { const path = await uploadMedia(user.id, cover, 'cover'); await supabase.from('teams').update({ cover_url: path }).eq('id', data[0].id); }
          await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] });
          if (role === 'host') { await queryClient.invalidateQueries({ queryKey: ['profile', user.id] }); setIndex(index + 1); setBusy(false); await finish(); return; }
          setCreated({ team: teamName.trim(), joinCode: data[0].join_code });
        } else {
          const clean = parseJoinCode(code);
          const { data: invite } = await supabase.rpc('get_team_invite', { _code: clean });
          if (!invite?.[0]) { setError(t('onboarding.invalidCode')); setBusy(false); return; }
          const { error: e } = await supabase.rpc('join_team_by_code', { _code: clean, _role: role === 'host' ? 'host' : 'member' }); if (e) throw e;
          await queryClient.invalidateQueries({ queryKey: ['workspace', user.id] });
          setJoined({ team: invite[0].team_name, leader: invite[0].leader_name }); requestPushMoment('joined');
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

  const shell = (content: React.ReactNode, showBar = true) => <div className="onboarding-screen">
    {showBar && total > 0 && <div className="onboarding-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index + 1, total)} aria-label={t('onboarding.step', { current: Math.min(index + 1, total), total })}><span style={{ width: `${(Math.min(index + 1, total) / total) * 100}%` }} /></div>}
    <div className="onboarding-top">{index > 0 && !atEnd ? <button type="button" className="auth-link" onClick={() => { setError(null); setIndex(index - 1); }}>{t('onboarding.back')}</button> : <span />}<LanguageToggle /></div>
    <main className="onboarding-body">{content}</main>
  </div>;

  if (!steps) return shell(<p className="auth-subtitle">{t('onboarding.saving')}</p>, false);

  if (atEnd && created) return shell(<>
    <div className="auth-icon"><Check /></div>
    <h1 className="onboarding-title">{t('onboarding.createdTitle')}</h1>
    <section className="invite-card" aria-labelledby="invite-card-title">
      <h2 id="invite-card-title">{t('onboarding.inviteCardTitle')}</h2>
      <p>{t('onboarding.inviteExplain', { team: created.team })}</p>
      <div className="copy-field"><code>{joinLink(created.joinCode)}</code><CopyButton text={joinLink(created.joinCode)} label={t('onboarding.copy')} /></div><ShareButton url={joinLink(created.joinCode)} />
      <div className="invite-qr"><QRCodeSVG value={joinLink(created.joinCode)} size={152} level="M" marginSize={2} title={t('onboarding.inviteQr')} /></div>
      <details className="invite-how"><summary>{t('onboarding.inviteHow')}</summary>
        <ol><li>{t('onboarding.inviteStep1', { team: created.team })}</li><li>{t('onboarding.inviteStep2')}</li><li>{t('onboarding.inviteStep3', { team: created.team })}</li></ol>
      </details>
    </section>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button className="onboarding-continue" disabled={finishing} onClick={() => void finish()}>{finishing ? t('onboarding.saving') : t('onboarding.goHome')}</Button>
  </>, false);

  if (atEnd && joined) return shell(<>
    <span className="eyebrow">{joined.team}</span>
    <h1 className="onboarding-title">{t('onboarding.welcomeTitle', { team: joined.team })}</h1>
    {joined.leader && <div className="leader-line"><span className="initial-avatar">{initialsOf(joined.leader)}</span><span>{t('onboarding.welcomeLed', { name: joined.leader })}</span></div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button className="onboarding-continue" disabled={finishing} onClick={() => void finish()}>{finishing ? t('onboarding.saving') : t('onboarding.goHome')}</Button>
  </>, false);

  if (atEnd) return shell(<p className="auth-subtitle">{t('onboarding.saving')}</p>, false);

  const roles = [{ key: 'guest', Icon: Compass }, { key: 'leader', Icon: Crown }, { key: 'host', Icon: CalendarHeart }, { key: 'member', Icon: UsersRound }] as const;

  return shell(<>
    {step === 'name' && <>
      <h1 className="onboarding-title">{t('onboarding.nameTitle')}</h1>
      <label className="field-label" htmlFor="full-name">{t('onboarding.nameLabel')}</label>
      <Input id="full-name" autoFocus autoComplete="name" maxLength={80} className="field-input" placeholder={t('onboarding.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
      <span className="field-label">{t('onboarding.photo')}</span>
      <div className="photo-row">
        {photoPreview ? <img src={photoPreview} alt="" className="photo-preview" /> : <span className="initial-avatar photo-preview">{initialsOf(name)}</span>}
        <label className="file-button"><Upload />{t('onboarding.upload')}<CropFileInput kind="avatar" className="hidden" onCropped={r => { setPhoto(r.file); setPhotoPreview(r.previewUrl); }} /></label>
        <label className="file-button"><Camera />{t('onboarding.camera')}<CropFileInput kind="avatar" capture="user" className="hidden" onCropped={r => { setPhoto(r.file); setPhotoPreview(r.previewUrl); }} /></label>
        {photo && <button type="button" className="auth-link" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>{t('onboarding.removePhoto')}</button>}
      </div>
    </>}
    {step === 'place' && <>
      <h1 className="onboarding-title">{t('onboarding.placeTitle')}</h1>
      {SPANISH_ENABLED && <><span className="field-label">{t('onboarding.language')}</span>
      <div className="choice-pair">{(['en', 'es'] as const).map(lang => <button key={lang} type="button" className={`choice-card ${i18n.resolvedLanguage === lang ? 'is-selected' : ''}`} aria-pressed={i18n.resolvedLanguage === lang} onClick={() => setLanguage(lang)}><strong>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</strong></button>)}</div></>}
      <label className="field-label" htmlFor="city">{t('onboarding.city')}</label>
      <Input id="city" autoComplete="address-level2" maxLength={80} className="field-input" placeholder={t('onboarding.cityPlaceholder')} value={city} onChange={e => setCity(e.target.value)} />
    </>}
    {step === 'role' && <>
      <h1 className="onboarding-title">{t('onboarding.roleTitle')}</h1>
      <div className="choice-list">{roles.map(({ key, Icon }) => <button key={key} type="button" className={`choice-card role-card ${role === key ? 'is-selected' : ''}`} aria-pressed={role === key} onClick={() => setRole(key)}><span className="creation-icon"><Icon /></span><span><strong>{t(`onboarding.${key}`)}</strong><small>{t(`onboarding.${key}Text`)}</small></span>{role === key && <Check className="choice-check" />}</button>)}</div>
    </>}
    {step === 'team' && (hostName ? <>
      <h1 className="onboarding-title">{t('onboarding.hostPageTitle')}</h1>
      <label className="field-label" htmlFor="team-name">{t('onboarding.hostPageLabel')}</label>
      <Input id="team-name" maxLength={80} className="field-input" value={teamName} onChange={e => setTeamName(e.target.value)} />
      <button type="button" className="auth-link" onClick={() => { setError(null); setHostJoin(true); }}>{t('onboarding.hostJoinInstead')}</button>
    </> : creating ? <>
      <h1 className="onboarding-title">{t('onboarding.createTitle')}</h1>
      <p className="auth-subtitle">{t('onboarding.createText')}</p>
      <label className="field-label" htmlFor="team-name">{t('onboarding.teamName')}</label>
      <Input id="team-name" maxLength={80} className="field-input" placeholder={t('onboarding.teamNamePlaceholder')} value={teamName} onChange={e => setTeamName(e.target.value)} />
      <span className="field-label">{t('onboarding.cover')}</span>
      <label className="file-button"><ImagePlus />{cover ? t('gathering.changePhoto') : t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={r => setCover(r.file)} /></label>
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
