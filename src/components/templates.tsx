import { CropFileInput } from '@/components/image-crop';
import { EmptyState } from '@/components/launch-states';
import { ClaimGuard } from '@/components/smart';
import { GatheringCover } from '@/components/gathering-cover';
import { CATEGORIES, isCategory } from '@/lib/landing';
import { confirmAction } from '@/components/confirm-dialog';
import { useTranslateFill } from '@/lib/assistant-client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
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
    <GatheringCover path={template.cover_url} style={template.cover_style} title={template.title} className="blueprint-cover" />
    <div className="template-body">
      <div className="template-meta">{template.team_id ? <span className={`chip ${template.is_published ? 'published-chip' : ''}`}>{t(template.is_published ? 'templates.published' : 'templates.draft')}</span> : <span className="chip">{t('templates.starter')}</span>}
        <span className="template-count">{t('templates.used', { count: template.launches_count })}</span></div>
      <h3>{template.title}</h3><span className="template-count">{template.category === 'more' ? template.category_label || t('marketing.other') : t(`landing.cat.${template.category}`)} · {t(template.default_mode === 'online' ? 'map.online' : 'map.person')}</span>{description && <p>{description}</p>}
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

export type TemplateDraft = Partial<Template> & { checklist?: string[] };

export function TemplateEditor({ draft, teamId, userId, onClose }: { draft: TemplateDraft | null; teamId: string; userId: string; onClose: () => void }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const [f, setF] = useState({ title: '', description: '', duration: '60', capacity: '', category: 'more', categoryLabel: '', mode: 'person', price: '', visibility: 'public' });
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!draft) return;
    setF({ title: draft.title ?? '', description: draft.description_en ?? '', duration: String(draft.default_duration_minutes ?? 60), capacity: draft.default_capacity ? String(draft.default_capacity) : '', category: draft.category ?? 'more', categoryLabel: draft.category_label ?? '', mode: draft.default_mode ?? 'person', price: draft.default_price_cents ? String(draft.default_price_cents / 100) : '', visibility: draft.visibility_default === 'team' ? 'team' : 'public' });
    setFile(null); setPreview(null);
  }, [draft]);
  const valid = !!f.title.trim() && Number(f.duration) >= 5 && Number(f.duration) <= 1440 && (!f.capacity || Number(f.capacity) >= 1) && (!f.price || (Number(f.price) >= 0 && Number(f.price) <= 1000));
  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const cover_url = file ? await uploadMedia(userId, file, 'cover') : draft.cover_url ?? null;
      const row = { title: f.title.trim(), description_en: f.description.trim() || null, description_es: draft.description_es ?? (f.description.trim() || null),
        category: isCategory(f.category) ? f.category : 'more', category_label: f.categoryLabel.trim() || null, default_mode: f.mode,
        default_duration_minutes: Number(f.duration), default_capacity: f.capacity ? Number(f.capacity) : null,
        default_price_cents: f.visibility === 'team' ? 0 : Math.round(Number(f.price || 0) * 100), visibility_default: f.visibility,
        cover_url, cover_style: draft.cover_style ?? 0, checklist: draft.checklist ?? [], is_published: true };
      const result = draft.id ? await supabase.from('templates').update(row).eq('id', draft.id).select('id').single() : await supabase.from('templates').insert({ ...row, team_id: teamId, created_by: userId }).select('id').single();
      if (result.error) throw result.error;
      toast.success(t('templates.saved')); await queryClient.invalidateQueries({ queryKey: ['templates'] }); onClose();
    } catch (error) { toast.error(errText(t, error)); }
    finally { setBusy(false); }
  };
  return <ResponsiveSheet open={!!draft} onOpenChange={o => { if (!o && !busy) onClose(); }} title={t(draft?.id ? 'templates.editTitle' : 'templates.newTitle')} footer={<Button className="w-full" disabled={busy || !valid} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>}>
    <div className="edit-form">
      <div className="form-field"><label htmlFor="tpl-title" className="field-label">{t('templates.title')}</label><Input id="tpl-title" value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} /></div>
      <div className="form-field"><label htmlFor="tpl-type" className="field-label">{t('templates.type')}</label><select id="tpl-type" className="field-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{t(c === 'more' ? 'marketing.other' : `landing.cat.${c}`)}</option>)}</select></div>
      {f.category === 'more' && <div className="form-field"><label htmlFor="tpl-custom-type" className="field-label">{t('marketing.customCategory')}</label><Input id="tpl-custom-type" value={f.categoryLabel} maxLength={60} onChange={e => setF({ ...f, categoryLabel: e.target.value })} /></div>}
      <div className="form-field"><label htmlFor="tpl-description" className="field-label">{t('templates.description')}</label><Textarea id="tpl-description" value={f.description} maxLength={2000} rows={4} onChange={e => setF({ ...f, description: e.target.value })} /><ClaimGuard text={f.description} lang="en" onUse={description => setF(x => ({ ...x, description }))} /></div>
      <div className="choice-pair"><div className="form-field"><label htmlFor="tpl-duration" className="field-label">{t('templates.duration')}</label><Input id="tpl-duration" type="number" min={5} max={1440} value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })} /></div><div className="form-field"><label htmlFor="tpl-capacity" className="field-label">{t('templates.capacity')}</label><Input id="tpl-capacity" type="number" min={1} placeholder={t('templates.noLimit')} value={f.capacity} onChange={e => setF({ ...f, capacity: e.target.value })} /></div></div>
      <div className="segmented full" role="group" aria-label={t('gathering.place')}>{(['person', 'online'] as const).map(mode => <Button key={mode} variant="ghost" aria-pressed={f.mode === mode} className={f.mode === mode ? 'selected' : ''} onClick={() => setF({ ...f, mode })}>{t(`map.${mode}`)}</Button>)}</div>
      <div className="form-field"><label htmlFor="tpl-visibility" className="field-label">{t('templates.visibility')}</label><select id="tpl-visibility" className="field-input" value={f.visibility} onChange={e => setF({ ...f, visibility: e.target.value, price: e.target.value === 'team' ? '' : f.price })}><option value="public">{t('gathering.vis.public')}</option><option value="team">{t('gathering.vis.team')}</option></select></div>
      <div className="form-field"><label htmlFor="tpl-price" className="field-label">{t('billing.price')}</label><Input id="tpl-price" type="number" min={0} max={1000} step="0.01" disabled={f.visibility === 'team'} value={f.price} placeholder="$0" onChange={e => setF({ ...f, price: e.target.value })} /><small className="field-hint">{t(f.visibility === 'team' ? 'templates.teamFree' : 'templates.priceStored')}</small></div>
      <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>{preview ? <img src={preview} alt={f.title} className="blueprint-editor-cover" /> : <GatheringCover path={draft?.cover_url ?? null} style={draft?.cover_style ?? 0} title={f.title} className="blueprint-editor-cover" />}<label className="file-button"><Upload />{t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={r => { setFile(r.file); setPreview(r.previewUrl); }} /></label></div>
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
  const navigate = useNavigate();
  const copy = async (tpl: Template) => {
    const { data: id, error } = await supabase.rpc('copy_starter_template', { _template: tpl.id, _team: teamId });
    if (error) { toast.error(errText(t, error)); return; }
    await queryClient.invalidateQueries({ queryKey: ['templates'] });
    const { data: row } = await supabase.from('templates').select('*').eq('id', id).single();
    toast.success(t('templates.copied')); if (row) setEditing(toDraft(row));
  };
  return <section className="panel">
    <div className="section-heading"><h2><Button asChild variant="link"><Link to="/blueprints">{t('templates.heading')}</Link></Button></h2><Button onClick={() => setEditing({ checklist: [], default_duration_minutes: 60, visibility_default: 'team' })}><Plus />{t('templates.new')}</Button></div>
    {own.length ? <div className="template-grid">{own.map(tpl => <TemplateCard key={tpl.id} template={tpl}><Button size="sm" variant="secondary" onClick={() => setEditing(toDraft(tpl))}><Pencil />{t('templates.edit')}</Button><Button size="sm" onClick={() => void navigate({ to: '/gathering/new', search: { template: tpl.id } })}>{t('templates.useThis')}</Button></TemplateCard>)}</div>
      : <EmptyState compact icon="Layers" text={t('templates.empty')} />}
    {starters.length > 0 && <><h3 className="subsection-title">{t('templates.starters')}</h3>
      <div className="template-grid">{starters.map(tpl => <TemplateCard key={tpl.id} template={tpl}><Button size="sm" variant="secondary" onClick={() => void navigate({ to: '/gathering/new', search: { template: tpl.id } })}><Copy />{t('templates.useThis')}</Button></TemplateCard>)}</div></>}
    <TemplateEditor draft={editing} teamId={teamId} userId={userId} onClose={() => setEditing(null)} />
  </section>;
}
