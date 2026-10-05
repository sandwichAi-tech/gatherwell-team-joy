import { requestPushMoment } from '@/components/notifications';
import { useEffect, useMemo, useState, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Award, CalendarCheck, UsersRound, ClipboardCheck, Layers, GraduationCap, Flag, Flame, HandHeart, Star, Medal, Trophy, Heart, Sun, Leaf,
  Footprints, Compass, Mountain, Crown, Smile, Download, Pin, EyeOff, Upload, Plus, Lock, Megaphone, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf, mediaUrl, profileQuery, uploadMedia, workspaceQuery } from '@/lib/account';
import { rosterQuery, teamKey } from '@/lib/team';
import {
  badgeName, badgeText, badgesQuery, hasBlockedClaim, hostOfMonthQuery, myBadgesQuery, pinnedShoutoutQuery, recognitionError, recognitionKey,
  summaryQuery, unseenBadgesQuery, type Badge, type Tier,
} from '@/lib/recognition';

export const BADGE_ICONS: Record<string, LucideIcon> = {
  Award, CalendarCheck, UsersRound, ClipboardCheck, Layers, GraduationCap, Flag, Flame, HandHeart, Star, Medal, Trophy, Heart, Sun, Leaf, Footprints, Compass, Mountain, Crown, Smile,
};
const CUSTOM_ICONS = ['Award', 'Star', 'Medal', 'Trophy', 'Heart', 'HandHeart', 'Flame', 'Sun', 'Leaf', 'Footprints', 'Compass', 'Mountain', 'Crown', 'Smile'] as const;
const TIER_COLORS: Record<Tier, { ring: string; fill: string; ink: string }> = {
  bronze: { ring: '#F3C6A5', fill: '#FBEDE3', ink: '#8A4E2B' },
  silver: { ring: '#B9A2D8', fill: '#EFEBF6', ink: '#5A4380' },
  gold: { ring: '#2F2340', fill: '#F3EEF8', ink: '#2F2340' },
};

export function Medallion({ badge, size = 72, locked = false }: { badge: Pick<Badge, 'icon' | 'tier'>; size?: number; locked?: boolean }) {
  const Icon = BADGE_ICONS[badge.icon] ?? Award;
  return <span className={`medallion tier-${badge.tier} ${locked ? 'is-locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
    <Icon strokeWidth={1.5} style={{ width: size * 0.4, height: size * 0.4 }} />
  </span>;
}

const haptic = () => { try { navigator.vibrate?.(18); } catch { /* unsupported */ } };

// ---------- Story-size share card ----------
async function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>(resolve => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; });
}

export async function downloadRecognitionCard(o: { eyebrow: string; title: string; subtitle?: string; name: string; photo?: string | null | undefined; icon: string; tier: Tier; team: string; file: string }) {
  await document.fonts?.ready;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d')!;
  x.fillStyle = '#F7F7F9'; x.fillRect(0, 0, 1080, 1920);
  x.strokeStyle = 'rgba(47,35,64,0.06)'; x.lineWidth = 2; for (let r = 260; r < 1300; r += 130) { x.beginPath(); x.arc(540, 760, r, 0, Math.PI * 2); x.stroke(); }
  // wordmark
  x.fillStyle = '#2F2340'; x.beginPath(); x.roundRect(96, 120, 88, 88, 22); x.fill();
  x.fillStyle = '#F3C6A5'; x.font = '600 66px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('g', 140, 186);
  x.textAlign = 'left'; x.fillStyle = '#2F2340'; x.font = '700 42px Inter, sans-serif'; x.fillText('Gatherwell', 212, 180);
  // medallion
  const tc = TIER_COLORS[o.tier];
  x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(540, 760, 250, 0, Math.PI * 2); x.fill();
  x.strokeStyle = tc.ring; x.lineWidth = 14; x.beginPath(); x.arc(540, 760, 236, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(47,35,64,0.12)'; x.lineWidth = 2; x.beginPath(); x.arc(540, 760, 204, 0, Math.PI * 2); x.stroke();
  x.fillStyle = tc.fill; x.beginPath(); x.arc(540, 760, 200, 0, Math.PI * 2); x.fill();
  const Icon = BADGE_ICONS[o.icon] ?? Award;
  const svg = renderToStaticMarkup(createElement(Icon, { size: 180, color: tc.ink, strokeWidth: 1.25 }));
  const icon = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (icon) x.drawImage(icon, 450, 670, 180, 180);
  // text
  x.textAlign = 'center';
  x.fillStyle = '#7A5FA8'; x.font = '600 34px Inter, sans-serif'; x.fillText(o.eyebrow.toUpperCase(), 540, 1150);
  x.fillStyle = '#2F2340'; x.font = '700 84px Inter, sans-serif';
  const words = o.title.split(' '); let row = ''; let y = 1260;
  for (const w of words) { if (x.measureText(`${row}${w} `).width > 880 && row) { x.fillText(row.trim(), 540, y); row = ''; y += 96; } row += `${w} `; } x.fillText(row.trim(), 540, y);
  if (o.subtitle) { x.fillStyle = '#5B5366'; x.font = '400 38px Inter, sans-serif'; x.fillText(o.subtitle.slice(0, 60), 540, y + 80); }
  // person
  const py = 1640;
  const photo = o.photo ? await loadImage(o.photo) : null;
  x.save(); x.beginPath(); x.arc(196, py, 64, 0, Math.PI * 2); x.closePath();
  if (photo) { x.clip(); x.drawImage(photo, 132, py - 64, 128, 128); } else { x.fillStyle = '#EFEBF6'; x.fill(); x.fillStyle = '#2F2340'; x.font = '600 48px Inter, sans-serif'; x.fillText(initialsOf(o.name), 196, py + 17); }
  x.restore();
  x.textAlign = 'left'; x.fillStyle = '#2F2340'; x.font = '600 48px Inter, sans-serif'; x.fillText(o.name, 290, py - 6);
  x.fillStyle = '#5B5366'; x.font = '400 36px Inter, sans-serif'; x.fillText(o.team, 290, py + 44);
  const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = o.file; a.click();
}

function useShareBadge() {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell();
  const { data: profile } = useQuery(profileQuery(userId)); const { data: ws } = useQuery(workspaceQuery(userId));
  return async (badge: Badge) => {
    const photo = profile?.avatar_url ? await mediaUrl(profile.avatar_url) : null;
    await downloadRecognitionCard({ eyebrow: t('recognition.cardBadge'), title: badgeName(badge, i18n.resolvedLanguage), subtitle: badgeText(badge, i18n.resolvedLanguage), name: profile?.full_name ?? '', photo, icon: badge.icon, tier: badge.tier, team: ws?.name ?? '', file: `gatherwell-${badge.code.slice(0, 24)}.png` });
  };
}

// ---------- Badge earned sheet (mounted once in the shell) ----------
export function BadgeEarnedWatcher() {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const { data = [] } = useQuery({ ...unseenBadgesQuery(userId), enabled: !!userId });
  const current = data[0];
  const share = useShareBadge();
  useEffect(() => { if (current) haptic(); }, [current?.id]);
  const close = async () => {
    if (!current) return;
    await supabase.rpc('mark_badges_seen', { _ids: [current.id] });
    if (current.badges.code === 'first_gathering') requestPushMoment('hosted');
    await queryClient.invalidateQueries({ queryKey: ['unseen-badges', userId] });
    await queryClient.invalidateQueries({ queryKey: recognitionKey(current.team_id) });
  };
  if (!current) return null;
  const b = current.badges;
  return <ResponsiveSheet open onOpenChange={o => { if (!o) void close(); }} title={t('recognition.earnedTitle')}>
    <div className="badge-earned">
      <Medallion badge={b} size={132} />
      <h3>{badgeName(b, i18n.resolvedLanguage)}</h3>
      <p>{badgeText(b, i18n.resolvedLanguage)}</p>
      {current.note && <p className="badge-note">“{current.note}”</p>}
      <div className="confirm-actions">
        <Button variant="secondary" onClick={() => void share(b)}><Download />{t('recognition.downloadCard')}</Button>
        <Button onClick={() => void close()}>{t('recognition.lovely')}</Button>
      </div>
    </div>
  </ResponsiveSheet>;
}

// ---------- Host of the Month ----------
export function useHostOfMonthId(teamId?: string) {
  return useQuery({ ...hostOfMonthQuery(teamId ?? ''), enabled: !!teamId }).data?.user_id ?? null;
}

export function HostOfMonthCard({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useQuery(hostOfMonthQuery(teamId));
  const { data: photo } = useQuery({ queryKey: ['media-url', data?.avatar], queryFn: () => mediaUrl(data?.avatar), enabled: !!data?.avatar, staleTime: 50 * 60 * 1000 });
  if (!data) return null;
  const month = new Date(`${data.month}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' });
  return <section className="panel host-month-card">
    <span className="hom-ring hom-avatar">{photo ? <img src={photo} alt="" /> : <span>{initialsOf(data.name)}</span>}</span>
    <div className="host-month-body"><span className="eyebrow"><Crown />{t('recognition.homEyebrow', { month })}</span><h2>{data.name ?? t('teamSpace.someone')}</h2>{data.note && <p>{data.note}</p>}</div>
    <Button variant="secondary" size="sm" onClick={() => void downloadRecognitionCard({ eyebrow: t('recognition.homEyebrow', { month }), title: t('recognition.homTitle'), name: data.name ?? '', photo, icon: 'Crown', tier: 'gold', team: teamName, file: 'gatherwell-host-of-the-month.png' })}><Download />{t('recognition.card')}</Button>
  </section>;
}

export function PinnedShoutout({ teamId, isLeader }: { teamId: string; isLeader: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data } = useQuery(pinnedShoutoutQuery(teamId));
  const { data: photo } = useQuery({ queryKey: ['media-url', data?.photo_path], queryFn: () => mediaUrl(data?.photo_path), enabled: !!data?.photo_path, staleTime: 50 * 60 * 1000 });
  if (!data) return null;
  return <section className="panel pinned-card shoutout-pinned"><span className="eyebrow pinned-label"><Pin />{t('recognition.pinnedShoutout')}</span>
    <p className="pinned-body"><strong>{t('recognition.shoutoutLine', { from: data.fromName ?? t('teamSpace.someone'), to: data.toName ?? t('teamSpace.someone') })}</strong> “{data.message}”</p>
    {photo && <img className="announcement-photo" src={photo} alt="" />}
    {isLeader && <Button variant="ghost" size="sm" className="quiet-action" onClick={async () => { const { error } = await supabase.rpc('moderate_shoutout', { _id: data.id, _action: 'unpin' }); if (error) toast.error(t(recognitionError(error))); await queryClient.invalidateQueries({ queryKey: recognitionKey(teamId) }); }}>{t('teamSpace.unpin')}</Button>}
  </section>;
}

export function ShoutoutModeration({ teamId, shoutoutId }: { teamId: string; shoutoutId: string }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const act = async (action: 'pin' | 'hide') => {
    const { error } = await supabase.rpc('moderate_shoutout', { _id: shoutoutId, _action: action });
    if (error) { toast.error(t(recognitionError(error))); return; }
    toast.success(t(action === 'pin' ? 'recognition.pinned' : 'recognition.hidden'));
    await queryClient.invalidateQueries({ queryKey: teamKey(teamId) });
  };
  return <span className="mod-actions">
    <button type="button" className="reaction" aria-label={t('teamSpace.pin')} title={t('teamSpace.pin')} onClick={() => void act('pin')}><Pin /></button>
    <button type="button" className="reaction" aria-label={t('recognition.hide')} title={t('recognition.hide')} onClick={() => void act('hide')}><EyeOff /></button>
  </span>;
}

function PersonPicker({ teamId, value, onChange, excludeSelf }: { teamId: string; value: string; onChange: (id: string) => void; excludeSelf?: boolean }) {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data: roster = [] } = useQuery(rosterQuery(teamId));
  const people = roster.filter(m => !excludeSelf || m.userId !== userId);
  return <div className="person-picker" role="radiogroup" aria-label={t('recognition.person')}>
    {people.map(m => <button type="button" role="radio" aria-checked={value === m.userId} key={m.userId} className={`person-chip ${value === m.userId ? 'is-selected' : ''}`} onClick={() => onChange(m.userId)}>
      <span className="initial-avatar">{initialsOf(m.name)}</span><span>{m.name ?? t('teamSpace.someone')}</span></button>)}
    {!people.length && <p className="auth-subtitle">{t('recognition.noPeople')}</p>}
  </div>;
}

export function ShoutoutSheet({ open, onOpenChange, teamId }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string }) {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const [to, setTo] = useState(''); const [msg, setMsg] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [claim, setClaim] = useState(false);
  useEffect(() => { if (!open) { setTo(''); setMsg(''); setFile(null); setClaim(false); } }, [open]);
  const send = async () => {
    if (hasBlockedClaim(msg)) { setClaim(true); return; }
    setBusy(true);
    try {
      const photo = file ? await uploadMedia(userId, file, 'announcement') : null;
      const { error } = await supabase.rpc('give_shoutout', { _team: teamId, _to: to, _message: msg.trim(), _photo: photo as string });
      if (error) { if (error.message.includes('claim_blocked')) setClaim(true); else toast.error(t(recognitionError(error))); setBusy(false); return; }
      toast.success(t('recognition.shoutoutSent')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);
    } catch (error) { toast.error(t(recognitionError(error))); }
    setBusy(false);
  };
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.giveShoutout')} description={t('recognition.shoutoutText')}>
    <div className="edit-form">
      <div className="form-field"><span className="field-label">{t('recognition.who')}</span><PersonPicker teamId={teamId} value={to} onChange={setTo} excludeSelf /></div>
      <div className="form-field"><div className="label-row"><label className="field-label" htmlFor="shoutout-msg">{t('teamSpace.message')}</label><span className={`char-count ${msg.length > 280 ? 'is-over' : ''}`}>{msg.length}/280</span></div>
        <Textarea id="shoutout-msg" rows={3} className="field-textarea" maxLength={280} value={msg} onChange={e => { setMsg(e.target.value); setClaim(false); }} placeholder={t('recognition.shoutoutPlaceholder')} />
        {claim && <p className="field-error" role="alert">{t('recognition.err.claim_blocked')}</p>}</div>
      <div className="photo-row"><label className="file-button"><Upload />{file ? file.name : t('teamSpace.addPhoto')}<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f && f.size > 5 * 1024 * 1024) { toast.error(t('profile.photoTooLarge')); return; } setFile(f ?? null); }} /></label>{file && <button type="button" className="auth-link" onClick={() => setFile(null)}>{t('onboarding.removePhoto')}</button>}</div>
      <Button className="onboarding-continue" disabled={busy || !to || !msg.trim()} onClick={() => void send()}><Megaphone />{busy ? t('onboarding.saving') : t('recognition.send')}</Button>
    </div>
  </ResponsiveSheet>;
}

// ---------- Leader tools ----------
type LeaderSheet = 'host' | 'award' | 'custom' | null;
export function RecognitionTools({ teamId }: { teamId: string }) {
  const { t } = useTranslation(); const [sheet, setSheet] = useState<LeaderSheet>(null);
  return <>
    <div className="tool-grid recognition-tools">
      <button type="button" className="tool-tile" onClick={() => setSheet('host')}><Crown /><span>{t('recognition.nameHost')}</span></button>
      <button type="button" className="tool-tile" onClick={() => setSheet('award')}><Award /><span>{t('recognition.awardBadge')}</span></button>
      <button type="button" className="tool-tile" onClick={() => setSheet('custom')}><Plus /><span>{t('recognition.newBadge')}</span></button>
    </div>
    <HostSheet open={sheet === 'host'} onOpenChange={o => !o && setSheet(null)} teamId={teamId} />
    <AwardSheet open={sheet === 'award'} onOpenChange={o => !o && setSheet(null)} teamId={teamId} />
    <CustomBadgeSheet open={sheet === 'custom'} onOpenChange={o => !o && setSheet(null)} teamId={teamId} />
  </>;
}

function HostSheet({ open, onOpenChange, teamId }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const [who, setWho] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setWho(''); setNote(''); } }, [open]);
  const save = async () => {
    if (hasBlockedClaim(note)) { toast.error(t('recognition.err.claim_blocked')); return; }
    setBusy(true); const { error } = await supabase.rpc('name_host_of_month', { _team: teamId, _user: who, _note: note.trim() }); setBusy(false);
    if (error) { toast.error(t(recognitionError(error))); return; }
    toast.success(t('recognition.homSaved')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);
  };
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.nameHost')} description={t('recognition.nameHostText')}>
    <div className="edit-form">
      <div className="form-field"><span className="field-label">{t('recognition.who')}</span><PersonPicker teamId={teamId} value={who} onChange={setWho} /></div>
      <div className="form-field"><label className="field-label" htmlFor="hom-note">{t('recognition.noteOptional')}</label><Textarea id="hom-note" rows={2} className="field-textarea" maxLength={280} value={note} onChange={e => setNote(e.target.value)} placeholder={t('recognition.homPlaceholder')} /></div>
      <Button className="onboarding-continue" disabled={busy || !who} onClick={() => void save()}><Crown />{t('recognition.nameHostCta')}</Button>
    </div>
  </ResponsiveSheet>;
}

function AwardSheet({ open, onOpenChange, teamId }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string }) {
  const { t, i18n } = useTranslation(); const queryClient = useQueryClient();
  const { data: badges = [] } = useQuery({ ...badgesQuery(teamId), enabled: open });
  const [who, setWho] = useState(''); const [badge, setBadge] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setWho(''); setBadge(''); setNote(''); } }, [open]);
  const save = async () => {
    if (hasBlockedClaim(note)) { toast.error(t('recognition.err.claim_blocked')); return; }
    setBusy(true); const { error } = await supabase.rpc('award_badge', { _team: teamId, _user: who, _badge: badge, _note: note.trim() }); setBusy(false);
    if (error) { toast.error(t(recognitionError(error))); return; }
    toast.success(t('recognition.awarded')); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onOpenChange(false);
  };
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.awardBadge')}>
    <div className="edit-form">
      <div className="form-field"><span className="field-label">{t('recognition.who')}</span><PersonPicker teamId={teamId} value={who} onChange={setWho} /></div>
      <div className="form-field"><span className="field-label">{t('recognition.whichBadge')}</span>
        <div className="badge-pick">{badges.map(b => <button type="button" key={b.id} aria-pressed={badge === b.id} className={`badge-option ${badge === b.id ? 'is-selected' : ''}`} onClick={() => setBadge(b.id)}><Medallion badge={b} size={44} /><span>{badgeName(b, i18n.resolvedLanguage)}</span></button>)}</div></div>
      <div className="form-field"><label className="field-label" htmlFor="award-note">{t('recognition.noteOptional')}</label><Textarea id="award-note" rows={2} className="field-textarea" maxLength={280} value={note} onChange={e => setNote(e.target.value)} /></div>
      <Button className="onboarding-continue" disabled={busy || !who || !badge} onClick={() => void save()}><Award />{t('recognition.awardCta')}</Button>
    </div>
  </ResponsiveSheet>;
}

function CustomBadgeSheet({ open, onOpenChange, teamId }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string }) {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const empty = { name_en: '', name_es: '', description_en: '', description_es: '', icon: 'Award', tier: 'bronze' as Tier };
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) setF(empty); }, [open]);
  const valid = f.name_en.trim() && f.name_es.trim();
  const save = async () => {
    if (hasBlockedClaim(`${f.name_en} ${f.name_es} ${f.description_en} ${f.description_es}`)) { toast.error(t('recognition.err.claim_blocked')); return; }
    setBusy(true);
    const { error } = await supabase.from('badges').insert({ ...f, name_en: f.name_en.trim(), name_es: f.name_es.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null, is_custom: true, team_id: teamId, created_by: userId });
    setBusy(false);
    if (error) { toast.error(t(recognitionError(error))); return; }
    toast.success(t('recognition.badgeCreated')); await queryClient.invalidateQueries({ queryKey: recognitionKey(teamId) }); onOpenChange(false);
  };
  const text = (key: keyof typeof empty, label: string, max: number, area = false) => <div className="form-field"><label className="field-label" htmlFor={`cb-${key}`}>{label}</label>
    {area ? <Textarea id={`cb-${key}`} rows={2} className="field-textarea" maxLength={max} value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} /> : <Input id={`cb-${key}`} className="field-input" maxLength={max} value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} />}</div>;
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('recognition.newBadge')}>
    <div className="edit-form">
      <div className="badge-preview"><Medallion badge={f} size={96} /></div>
      {text('name_en', t('recognition.nameEn'), 40)}{text('name_es', t('recognition.nameEs'), 40)}
      {text('description_en', t('recognition.descEn'), 160, true)}{text('description_es', t('recognition.descEs'), 160, true)}
      <div className="form-field"><span className="field-label">{t('recognition.icon')}</span>
        <div className="icon-pick">{CUSTOM_ICONS.map(name => { const Icon = BADGE_ICONS[name]!; return <button type="button" key={name} aria-label={name} aria-pressed={f.icon === name} className={`icon-option ${f.icon === name ? 'is-selected' : ''}`} onClick={() => setF({ ...f, icon: name })}><Icon strokeWidth={1.5} /></button>; })}</div></div>
      <div className="form-field"><span className="field-label">{t('recognition.tier')}</span>
        <div className="choice-pair three">{(['bronze', 'silver', 'gold'] as const).map(tier => <button type="button" key={tier} aria-pressed={f.tier === tier} className={`choice-card ${f.tier === tier ? 'is-selected' : ''}`} onClick={() => setF({ ...f, tier })}><strong>{t(`recognition.tiers.${tier}`)}</strong></button>)}</div></div>
      <Button className="onboarding-continue" disabled={busy || !valid} onClick={() => void save()}>{t('common.create')}</Button>
    </div>
  </ResponsiveSheet>;
}

// ---------- Me: badge wall ----------
export function RecognitionSummary({ teamId }: { teamId: string }) {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data } = useQuery(summaryQuery(teamId, userId));
  return <div className="recognition-summary">
    {([['badges', 'sumBadges'], ['shoutouts', 'sumShoutouts'], ['hostOfMonth', 'sumHom']] as const).map(([k, label]) => <div key={k}><strong>{data?.[k] ?? 0}</strong><span>{t(`recognition.${label}`)}</span></div>)}
  </div>;
}

export function BadgeWall({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell();
  const { data: badges = [] } = useQuery(badgesQuery(teamId));
  const { data: earned = [] } = useQuery(myBadgesQuery(teamId, userId));
  const share = useShareBadge();
  const byId = useMemo(() => new Map(earned.map(e => [e.badge_id, e])), [earned]);
  const sorted = [...badges].sort((a, b) => Number(byId.has(b.id)) - Number(byId.has(a.id)));
  const lang = i18n.resolvedLanguage;
  return <div className="badge-wall-wrap">
    <RecognitionSummary teamId={teamId} />
    {!earned.length && <span className="chip sample-badge">{t('recognition.noneYet')}</span>}
    <div className="badge-wall">{sorted.map(b => { const e = byId.get(b.id); return <div className={`badge-tile ${e ? '' : 'is-locked'}`} key={b.id}>
      <Medallion badge={b} size={64} locked={!e} />
      <strong>{badgeName(b, lang)}</strong>
      {e ? <small>{t('recognition.earnedOn', { date: new Date(e.awarded_at).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' }) })}</small>
        : <small><Lock className="inline-icon" />{badgeText(b, lang) || t('recognition.leaderAwarded')}</small>}
      {e && <button type="button" className="auth-link badge-share" onClick={() => void share(b)}><Download />{t('recognition.card')}</button>}
    </div>; })}</div>
  </div>;
}
