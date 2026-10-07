import { CopyButton } from '@/components/copy-button';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Plus, Repeat, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import type { RsvpQuestion } from '@/lib/guest';

const db = supabase as any;
export const MAX_QUESTIONS = 5;

export function answersReady(qs: RsvpQuestion[] | undefined, a: Record<string, string>) {
  return (qs ?? []).every(q => !q.required || !!a[q.id]?.trim());
}

/** Guest-side answer fields shown in the RSVP sheet. */
export function RsvpQuestionsFields({ questions, value, onChange }: { questions: RsvpQuestion[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useTranslation();
  const set = (id: string, v: string) => onChange({ ...value, [id]: v });
  return <fieldset className="rsvpq-fields"><legend className="field-label">{t('rsvpq.guestHeading')}</legend>
    {questions.map(q => {
      const label = <>{q.label}{q.required ? <span className="rsvpq-req"> {t('rsvpq.requiredMark')}</span> : null}</>;
      if (q.kind === 'text') return <div key={q.id}><label className="field-label" htmlFor={`q-${q.id}`}>{label}</label>
        <Input id={`q-${q.id}`} maxLength={500} className="field-input" value={value[q.id] ?? ''} onChange={e => set(q.id, e.target.value)} /></div>;
      const opts = q.kind === 'yesno' ? [['yes', t('rsvpq.yes')], ['no', t('rsvpq.no')]] : (q.options ?? []).map(o => [o, o]);
      return <div key={q.id} role="radiogroup" aria-label={q.label}><span className="field-label">{label}</span>
        <div className="rsvpq-choices">{opts.map(([v, l]) => <Button key={v} type="button" variant="secondary" role="radio" aria-checked={value[q.id] === v} className={value[q.id] === v ? 'selected' : ''} onClick={() => set(q.id, v!)}>{l}</Button>)}</div></div>;
    })}
  </fieldset>;
}

type Settings = { questions: RsvpQuestion[]; require_approval: boolean; visibility: string; invite_token: string; price_cents: number | null };

/** Host panel: RSVP questions, approval and invite-only link. */
export function RsvpSettingsPanel({ eventId, initial }: { eventId: string; initial: Settings }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const [qs, setQs] = useState<RsvpQuestion[]>(initial.questions ?? []); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(initial.invite_token);
  useEffect(() => { setQs(initial.questions ?? []); setDirty(false); }, [initial.questions]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['event', eventId] });
  const patch = async (p: Record<string, unknown>) => {
    const { error } = await db.from('events').update(p).eq('id', eventId);
    if (error) { toast.error(String(error.message).includes('approval_paid') ? t('rsvpq.approvalPaid') : t('profile.saveError')); return false; }
    await refresh(); return true;
  };
  const edit = (i: number, p: Partial<RsvpQuestion>) => { setQs(qs.map((q, j) => j === i ? { ...q, ...p } : q)); setDirty(true); };
  const add = () => { setQs([...qs, { id: Math.random().toString(36).slice(2, 10), kind: 'text', label: '', required: false }]); setDirty(true); };
  const save = async () => {
    const clean = qs.map(q => ({ ...q, label: q.label.trim(), options: q.kind === 'choice' ? (q.options ?? []).map(o => o.trim()).filter(Boolean) : undefined }));
    if (clean.some(q => !q.label || (q.kind === 'choice' && (q.options?.length ?? 0) < 2))) { toast.error(t('rsvpq.incomplete')); return; }
    setBusy(true); const ok = await patch({ rsvp_questions: clean }); setBusy(false);
    if (ok) { setDirty(false); toast.success(t('rsvpq.saved')); }
  };
  const link = `${typeof window === 'undefined' ? '' : window.location.origin}/e/${eventId}?k=${token}`;
  const invite = initial.visibility === 'invite';
  return <section className="panel rsvpq-panel">
    <h2>{t('rsvpq.heading')}</h2>
    <div className="setting-row"><div><strong>{t('rsvpq.approval')}</strong><p className="auth-subtitle">{initial.price_cents ? t('rsvpq.approvalPaid') : t('rsvpq.approvalHelp')}</p></div>
      <Switch checked={initial.require_approval} disabled={!!initial.price_cents} onCheckedChange={v => void patch({ require_approval: v })} aria-label={t('rsvpq.approval')} /></div>
    <div className="setting-row"><div><strong>{t('rsvpq.inviteOnly')}</strong><p className="auth-subtitle">{t('rsvpq.inviteOnlyHelp')}</p></div>
      <Switch checked={invite} onCheckedChange={v => void patch({ visibility: v ? 'invite' : 'public' })} aria-label={t('rsvpq.inviteOnly')} /></div>
    {invite && <div className="rsvpq-link"><code>{link}</code>
      <div className="guest-button-row"><CopyButton text={link} />
        <Button variant="ghost" onClick={async () => { const { data, error } = await db.rpc('reset_invite_link', { _event: eventId }); if (error) { toast.error(t('profile.saveError')); return; } setToken(data); toast.success(t('rsvpq.linkReset')); }}><Repeat />{t('rsvpq.resetLink')}</Button></div></div>}
    <h3 className="guest-subhead">{t('rsvpq.questions', { count: qs.length, max: MAX_QUESTIONS })}</h3>
    {qs.map((q, i) => <div key={q.id} className="rsvpq-edit">
      <label className="field-label" htmlFor={`qe-${q.id}`}>{t('rsvpq.questionLabel', { n: i + 1 })}</label>
      <Input id={`qe-${q.id}`} maxLength={140} className="field-input" value={q.label} placeholder={t('rsvpq.placeholder')} onChange={e => edit(i, { label: e.target.value })} />
      <div className="segmented full" role="group" aria-label={t('rsvpq.kind')}>{(['text', 'choice', 'yesno'] as const).map(k => <Button key={k} type="button" variant="ghost" className={q.kind === k ? 'selected' : ''} aria-pressed={q.kind === k} onClick={() => edit(i, { kind: k, options: k === 'choice' ? (q.options?.length ? q.options : ['', '']) : undefined })}>{t(`rsvpq.kinds.${k}`)}</Button>)}</div>
      {q.kind === 'choice' && <div className="rsvpq-options">{(q.options ?? []).map((o, j) => <div key={j} className="rsvpq-option">
        <Input aria-label={t('rsvpq.option', { n: j + 1 })} maxLength={60} className="field-input" value={o} onChange={e => edit(i, { options: (q.options ?? []).map((x, k) => k === j ? e.target.value : x) })} />
        <Button type="button" size="icon" variant="ghost" aria-label={t('rsvpq.removeOption')} disabled={(q.options?.length ?? 0) <= 2} onClick={() => edit(i, { options: (q.options ?? []).filter((_, k) => k !== j) })}><Trash2 /></Button></div>)}
        {(q.options?.length ?? 0) < 6 && <Button type="button" variant="ghost" onClick={() => edit(i, { options: [...(q.options ?? []), ''] })}><Plus />{t('rsvpq.addOption')}</Button>}</div>}
      <div className="setting-row"><span>{t('rsvpq.required')}</span><Switch checked={!!q.required} onCheckedChange={v => edit(i, { required: v })} aria-label={t('rsvpq.required')} /></div>
      <Button type="button" variant="ghost" className="danger-text" onClick={() => { setQs(qs.filter((_, j) => j !== i)); setDirty(true); }}><Trash2 />{t('rsvpq.remove')}</Button>
    </div>)}
    <div className="guest-button-row">
      {qs.length < MAX_QUESTIONS && <Button variant="secondary" onClick={add}><Plus />{t('rsvpq.add')}</Button>}
      {dirty && <Button onClick={save} disabled={busy}>{t('rsvpq.save')}</Button>}
    </div>
  </section>;
}
