import { useTranslateFill } from '@/lib/assistant-client';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Rocket, Upload, ArrowUp, ArrowDown, Trash2, Languages, Copy, Pencil } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { mediaUrl, uploadMedia } from '@/lib/account';
import { teamKey } from '@/lib/team';
import { checklistOf, templatesQuery, type Template } from '@/lib/templates';

function useSignedUrl(path?: string | null) {
  return useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 }).data ?? null;
}

function errText(t: (k: string) => string, error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('not_allowed')) return t('teamSpace.notAllowed');
  if (message.includes('invalid_url')) return t('templates.invalidUrl');
  return t('profile.saveError');
}

export function TemplateCard({ template, children }: { template: Template; children?: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const cover = useSignedUrl(template.cover_url);
  const description = i18n.resolvedLanguage === 'es' ? template.description_es || template.description_en : template.description_en || template.description_es;
  return <article className="template-card">
    <div className="template-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>{!cover && <span className="team-cover-initial">{(template.title.trim()[0] ?? 'T').toUpperCase()}</span>}</div>
    <div className="template-body">
      <div className="template-meta">{template.team_id ? <span className={`chip ${template.is_published ? 'published-chip' : ''}`}>{t(template.is_published ? 'templates.published' : 'templates.draft')}</span> : <span className="chip">{t('templates.starter')}</span>}
        {template.team_id && <span className="template-count">{t('templates.launched', { count: template.launches_count })}</span>}</div>
      <h3>{template.title}</h3>{description && <p>{description}</p>}
      {children && <div className="template-actions">{children}</div>}
    </div>
  </article>;
}

/** "From your leader": published team templates the caller can launch. */
export function FromYourLeader({ teamId, role, onLaunch, compact = false }: { teamId: string; role: string; onLaunch?: (template: Template) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { data = [] } = useQuery(templatesQuery());
  const navigate = useNavigate();
  const list = data.filter(tpl => tpl.team_id && tpl.is_published);
  if (role === 'member' || !list.length) return null;
  const launch = onLaunch ?? ((tpl: Template) => void navigate({ to: '/gathering/new', search: { template: tpl.id } }));
  return <section className={compact ? 'from-leader compact' : 'panel from-leader'}>
    <div className="section-heading"><h2>{t('templates.fromLeader')}</h2></div>
    <div className="template-row">{list.map(tpl => <TemplateCard key={tpl.id} template={tpl}><Button size="sm" onClick={() => launch(tpl)}><Rocket />{t('templates.launchMine')}</Button></TemplateCard>)}</div>
  </section>;
}

export function LaunchSheet({ template, teamId, onClose }: { template: Template | null; teamId: string; onClose: () => void }) {
  const { t } = useTranslation(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [date, setDate] = useState(''); const [time, setTime] = useState('18:00'); const [place, setPlace] = useState(''); const [link, setLink] = useState(''); const [publish, setPublish] = useState(true); const [busy, setBusy] = useState(false);
  useEffect(() => { if (template) { const d = new Date(); d.setDate(d.getDate() + 7); setDate(d.toISOString().slice(0, 10)); setPlace(''); setLink(''); setPublish(true); } }, [template]);
  const submit = async () => {
    if (!template || !date || !time) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('launch_template', {
      _template: template.id, _team: teamId, _starts_at: new Date(`${date}T${time}`).toISOString(), _timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      _location_name: place.trim(), _online_url: link.trim(), _publish: publish,
    });
    setBusy(false);
    if (error || !data) { toast.error(errText(t, error)); return; }
    toast.success(t(publish ? 'templates.launchedToast' : 'templates.draftToast'));
    await queryClient.invalidateQueries({ queryKey: ['templates'] }); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) });
    onClose(); void navigate({ to: '/event/$id', params: { id: data } });
  };
  return <ResponsiveSheet open={!!template} onOpenChange={o => !o && onClose()} title={template?.title ?? ''} description={t('templates.launchText')}>
    <div className="edit-form">
      <div className="choice-pair">
        <div className="form-field"><label className="field-label" htmlFor="launch-date">{t('templates.date')}</label><Input id="launch-date" type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="form-field"><label className="field-label" htmlFor="launch-time">{t('templates.time')}</label><Input id="launch-time" type="time" className="field-input" value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div className="form-field"><label className="field-label" htmlFor="launch-place">{t('templates.place')}</label><Input id="launch-place" className="field-input" maxLength={160} placeholder={t('templates.placePlaceholder')} value={place} onChange={e => setPlace(e.target.value)} /></div>
      <div className="form-field"><label className="field-label" htmlFor="launch-link">{t('templates.onlineLink')}</label><Input id="launch-link" type="url" className="field-input" placeholder="https://" value={link} onChange={e => setLink(e.target.value)} /></div>
      <label className="switch-row"><Switch checked={publish} onCheckedChange={setPublish} /><span><strong>{t('templates.publishNow')}</strong><small>{t('templates.publishNowText')}</small></span></label>
      <Button className="onboarding-continue" disabled={busy || !date || !time} onClick={submit}><Rocket />{busy ? t('onboarding.saving') : t(publish ? 'templates.publish' : 'templates.saveDraft')}</Button>
    </div>
  </ResponsiveSheet>;
}

export type TemplateDraft = Partial<Pick<Template, 'id' | 'title' | 'description_en' | 'description_es' | 'cover_url' | 'default_duration_minutes' | 'default_capacity' | 'visibility_default' | 'invite_script_en' | 'invite_script_es' | 'followup_script_en' | 'followup_script_es' | 'is_published'>> & { checklist?: string[] };

export function TemplateEditor({ draft, teamId, userId, onClose }: { draft: TemplateDraft | null; teamId: string; userId: string; onClose: () => void }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const empty = { title: '', description_en: '', description_es: '', duration: '60', capacity: '', visibility: 'team' as 'team' | 'public', invite_en: '', invite_es: '', follow_en: '', follow_es: '', published: false };
  const [f, setF] = useState(empty); const [items, setItems] = useState<string[]>([]); const [newItem, setNewItem] = useState('');
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const cover = useSignedUrl(draft?.cover_url);
  useEffect(() => {
    if (!draft) return;
    setF({ title: draft.title ?? '', description_en: draft.description_en ?? '', description_es: draft.description_es ?? '', duration: String(draft.default_duration_minutes ?? 60), capacity: draft.default_capacity ? String(draft.default_capacity) : '',
      visibility: draft.visibility_default === 'public' ? 'public' : 'team', invite_en: draft.invite_script_en ?? '', invite_es: draft.invite_script_es ?? '', follow_en: draft.followup_script_en ?? '', follow_es: draft.followup_script_es ?? '', published: !!draft.is_published });
    setItems(draft.checklist ?? []); setNewItem(''); setFile(null); setPreview(null);
  }, [draft]);
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [key]: e.target.value });
  const move = (i: number, d: number) => setItems(list => { const next = [...list]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x!); return next; });
  const tr = useTranslateFill();
  const save = async () => {
    if (!f.title.trim()) return; setBusy(true);
    try {
      const cover_url = file ? await uploadMedia(userId, file, 'cover') : draft?.cover_url ?? null;
      const duration = Math.min(1440, Math.max(5, parseInt(f.duration, 10) || 60)); const cap = parseInt(f.capacity, 10);
      const row = { title: f.title.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null, cover_url, default_duration_minutes: duration,
        default_capacity: cap > 0 ? cap : null, visibility_default: f.visibility, checklist: items, invite_script_en: f.invite_en.trim() || null, invite_script_es: f.invite_es.trim() || null,
        followup_script_en: f.follow_en.trim() || null, followup_script_es: f.follow_es.trim() || null, is_published: f.published };
      const { error } = draft?.id ? await supabase.from('templates').update(row).eq('id', draft.id) : await supabase.from('templates').insert({ ...row, team_id: teamId, created_by: userId });
      if (error) throw error;
      toast.success(t('templates.saved')); await queryClient.invalidateQueries({ queryKey: ['templates'] }); await queryClient.invalidateQueries({ queryKey: teamKey(teamId) }); onClose();
    } catch (error) { toast.error(errText(t, error)); }
    setBusy(false);
  };
  const shown = preview ?? cover;
  const bilingual = (label: string, en: keyof typeof empty, es: keyof typeof empty, rows = 3) => <div className="bilingual">
    <div className="form-field"><label className="field-label" htmlFor={`tpl-${en}`}>{label} · EN</label><Textarea id={`tpl-${en}`} rows={rows} className="field-textarea" maxLength={2000} value={f[en] as string} onChange={set(en)} /></div>
    <div className="form-field"><div className="label-row"><label className="field-label" htmlFor={`tpl-${es}`}>{label} · ES</label><button type="button" className="translate-button" disabled={tr.busy} onClick={() => tr.run(f[en] as string, f[es] as string, v => setF(x => ({ ...x, [en]: v })), v => setF(x => ({ ...x, [es]: v })))}><Languages />{tr.busy ? t('assistant.translating') : t('templates.translate')}</button></div><Textarea id={`tpl-${es}`} rows={rows} className="field-textarea" maxLength={2000} value={f[es] as string} onChange={set(es)} /></div>
  </div>;
  return <ResponsiveSheet open={!!draft} onOpenChange={o => !o && onClose()} title={draft?.id ? t('templates.editTitle') : t('templates.newTitle')}>
    <div className="edit-form">
      <div className="form-field"><label className="field-label" htmlFor="tpl-title">{t('templates.title')}</label><Input id="tpl-title" className="field-input" maxLength={120} value={f.title} onChange={set('title')} /></div>
      <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
        <div className="cover-edit" style={shown ? { backgroundImage: `url(${shown})` } : undefined}>{!shown && <span className="team-cover-initial">{(f.title.trim()[0] ?? 'T').toUpperCase()}</span>}</div>
        <label className="file-button"><Upload />{t('onboarding.uploadCover')}<input type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) { setFile(x); setPreview(URL.createObjectURL(x)); } }} /></label></div>
      {bilingual(t('templates.description'), 'description_en', 'description_es')}
      <div className="choice-pair">
        <div className="form-field"><label className="field-label" htmlFor="tpl-duration">{t('templates.duration')}</label><Input id="tpl-duration" type="number" min={5} max={1440} className="field-input" value={f.duration} onChange={set('duration')} /></div>
        <div className="form-field"><label className="field-label" htmlFor="tpl-capacity">{t('templates.capacity')}</label><Input id="tpl-capacity" type="number" min={1} className="field-input" placeholder={t('templates.noLimit')} value={f.capacity} onChange={set('capacity')} /></div>
      </div>
      <div className="form-field"><span className="field-label">{t('templates.visibility')}</span>
        <div className="choice-pair">{(['team', 'public'] as const).map(v => <button type="button" key={v} className={`choice-card ${f.visibility === v ? 'is-selected' : ''}`} aria-pressed={f.visibility === v} onClick={() => setF({ ...f, visibility: v })}><strong>{t(`teamSpace.visibility.${v}`)}</strong></button>)}</div></div>
      <div className="form-field"><span className="field-label">{t('templates.checklist')}</span>
        <ol className="checklist-editor">{items.map((item, i) => <li key={`${item}-${i}`}><span>{item}</span>
          <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => move(i, -1)}><ArrowUp /></Button>
          <Button variant="ghost" size="icon" disabled={i === items.length - 1} aria-label={t('templates.moveDown')} onClick={() => move(i, 1)}><ArrowDown /></Button>
          <Button variant="ghost" size="icon" aria-label={t('teamSpace.delete')} onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button></li>)}</ol>
        <form className="inline-form" onSubmit={e => { e.preventDefault(); if (newItem.trim()) { setItems([...items, newItem.trim().slice(0, 140)]); setNewItem(''); } }}>
          <Input className="field-input" placeholder={t('templates.addItem')} aria-label={t('templates.addItem')} value={newItem} onChange={e => setNewItem(e.target.value)} /><Button variant="secondary" disabled={!newItem.trim()}><Plus />{t('templates.add')}</Button></form></div>
      {bilingual(t('templates.inviteScript'), 'invite_en', 'invite_es')}
      {bilingual(t('templates.followupScript'), 'follow_en', 'follow_es')}
      <label className="switch-row"><Switch checked={f.published} onCheckedChange={v => setF({ ...f, published: v })} /><span><strong>{t('templates.publishToggle')}</strong><small>{t('templates.publishToggleText')}</small></span></label>
      <Button className="onboarding-continue" disabled={busy || !f.title.trim()} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
    </div>
  </ResponsiveSheet>;
}

export const toDraft = (tpl: Template): TemplateDraft => ({ ...tpl, checklist: checklistOf(tpl) });

/** Leader library: team templates plus starters that can be copied in. */
export function TemplatesSection({ teamId, userId }: { teamId: string; userId: string }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data = [] } = useQuery(templatesQuery());
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const own = data.filter(tpl => tpl.team_id === teamId);
  const starters = data.filter(tpl => !tpl.team_id);
  const copy = async (tpl: Template) => {
    const { data: id, error } = await supabase.rpc('copy_starter_template', { _template: tpl.id, _team: teamId });
    if (error) { toast.error(errText(t, error)); return; }
    await queryClient.invalidateQueries({ queryKey: ['templates'] });
    const { data: row } = await supabase.from('templates').select('*').eq('id', id).single();
    toast.success(t('templates.copied')); if (row) setEditing(toDraft(row));
  };
  return <section className="panel">
    <div className="section-heading"><h2>{t('templates.heading')}</h2><Button onClick={() => setEditing({ checklist: [], default_duration_minutes: 60, visibility_default: 'team' })}><Plus />{t('templates.new')}</Button></div>
    {own.length ? <div className="template-grid">{own.map(tpl => <TemplateCard key={tpl.id} template={tpl}><Button size="sm" variant="secondary" onClick={() => setEditing(toDraft(tpl))}><Pencil />{t('templates.edit')}</Button></TemplateCard>)}</div>
      : <p className="auth-subtitle">{t('templates.empty')}</p>}
    {starters.length > 0 && <><h3 className="subsection-title">{t('templates.starters')}</h3>
      <div className="template-grid">{starters.map(tpl => <TemplateCard key={tpl.id} template={tpl}><Button size="sm" variant="secondary" onClick={() => copy(tpl)}><Copy />{t('templates.useThis')}</Button></TemplateCard>)}</div></>}
    <TemplateEditor draft={editing} teamId={teamId} userId={userId} onClose={() => setEditing(null)} />
  </section>;
}
