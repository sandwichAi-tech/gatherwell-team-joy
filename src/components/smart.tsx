import { EmptyState } from '@/components/launch-states';
import { trackEvent } from '@/lib/analytics';
import { ListSkeleton } from '@/components/launch-states';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CircleCheck, Circle, Mail, MessageCircle, MessageSquareText, Pencil, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useGatherwell } from '@/components/gatherwell-shell';
import { myCohostedEventIds } from '@/components/cohosts';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { dailyBriefQuery } from '@/lib/daily-brief-query';
import { hasBlockedClaim } from '@/lib/recognition';
import { prepareFollowupsNow, sendFollowup, suggestRewrite, summarizeLesson } from '@/lib/smart.functions';

const useLang = () => { const { i18n } = useTranslation(); return (i18n.resolvedLanguage === 'es' ? 'es' : 'en') as 'en' | 'es'; };

/* ---------------- Claims guard ---------------- */

/** Gentle inline note under any public text field; offers suggested wording. */
export function ClaimGuard({ text, onUse, lang: forced }: { text: string; onUse: (v: string) => void; lang?: 'en' | 'es' }) {
  const { t } = useTranslation(); const ui = useLang(); const lang = forced ?? ui;
  const fn = useServerFn(suggestRewrite);
  const flagged = useMemo(() => !!text.trim() && hasBlockedClaim(text), [text]);
  const [s, setS] = useState<{ for: string; text: string } | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!flagged) return;
    const h = setTimeout(async () => {
      setBusy(true);
      try { const r = await fn({ data: { text, lang } }); setS({ for: text, text: r.text }); } catch { setS(null); } finally { setBusy(false); }
    }, 700);
    return () => clearTimeout(h);
  }, [flagged, text, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!flagged) return null;
  const sug = s && s.for === text ? s.text : null;
  return <div className="claim-note" role="status"><AlertCircle /><div><p>{t('smart.claims.note')}</p>
    {sug ? <><p className="claim-suggest">{sug}</p><Button type="button" size="sm" variant="secondary" onClick={() => onUse(sug)}>{t('smart.claims.use')}</Button></> : busy ? <p className="claim-suggest muted">{t('smart.claims.thinking')}</p> : null}
  </div></div>;
}

/* ---------------- Home: daily brief ---------------- */

export function DailyBriefCard() {
  const { t } = useTranslation(); const lang = useLang(); const { userId } = useGatherwell();
  const { data } = useSuspenseQuery(dailyBriefQuery(userId, lang));
  const text = (line: typeof data.lines[number]) => // The long check-in code is never the primary Home display; the Next up QR sheet carries it.
  t(`smart.brief.${line.label === 'attendingCode' ? 'attending' : line.label}`, {
    ...line.values,
    when: typeof line.values['when'] === 'string' ? new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(line.values['when'])) : '',
    place: line.values['place'] ? ` · ${line.values['place']}` : '',
  });
  return <section className="brief-card morning-brief" aria-labelledby="brief-h">
    <div className="section-heading"><div><span className="eyebrow">{t('smart.brief.eyebrow')}</span><h2 id="brief-h">{t('smart.brief.title')}</h2></div></div>
    {data.lines.length ? <ul className="brief-lines">{data.lines.map(line => {
      const content = <>{text(line)}<ArrowRight /></>;
      return <li key={line.key}>{line.target === 'team' ? <Link to="/team/insights">{content}</Link>
        : line.label === 'signups' ? <Link to="/event/$id/guests" params={{ id: line.id ?? '' }}>{content}</Link>
        : line.target === 'resource' ? line.values['kind'] === 'recipe' ? <Link to="/learn/recipe/$id" params={{ id: line.id ?? '' }}>{content}</Link>
          : line.values['kind'] === 'track' ? <Link to="/learn/track/$id" params={{ id: line.id ?? '' }}>{content}</Link>
          : <Link to="/learn/lesson/$id" params={{ id: line.id ?? '' }}>{content}</Link>
        : line.target === 'attending' ? <Link to="/e/$id" params={{ id: line.id ?? '' }}>{content}</Link>
        : <Link to="/event/$id" params={{ id: line.id ?? '' }}>{content}</Link>}</li>;
    })}</ul> : <div className="brief-empty"><p>{t('smart.brief.empty')}</p><Button asChild><Link to="/gathering/new">{t('smart.brief.create')}<ArrowRight /></Link></Button></div>}
  </section>;
}

/* ---------------- Home: follow-ups waiting ---------------- */

async function scopeFilter(userId: string) { const ids = await myCohostedEventIds(userId); return ids.length ? `host_id.eq.${userId},event_id.in.(${ids.join(',')})` : `host_id.eq.${userId}`; }

export function FollowupsHomeCard() {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data } = useQuery({
    queryKey: ['followups', userId, 'summary'], queryFn: async () => {
      const { data } = await supabase.from('followup_drafts')
        .select('event_id, events(title)').or(await scopeFilter(userId)).in('status', ['draft', 'approved']);
      const rows = (data ?? []) as unknown as { event_id: string; events: { title: string } | null }[];
      return { count: rows.length, title: rows[0]?.events?.title ?? '', events: new Set(rows.map(r => r.event_id)).size };
    },
  });
  if (!data?.count) return null;
  return <section className="panel followup-home"><div className="person-info"><span className="eyebrow">{t('smart.followups.eyebrow')}</span>
    <h2>{data.events > 1 ? t('smart.followups.readyMany', { count: data.count }) : t('smart.followups.ready', { count: data.count, title: data.title })}</h2></div>
    <Button asChild><Link to="/followups">{t('smart.followups.review')}<ArrowRight /></Link></Button></section>;
}

/* ---------------- Home: new member plan ---------------- */

type PlanItem = { kind: 'lesson' | 'rsvp' | 'template' | 'introduce'; ref?: string; title_en?: string; title_es?: string; done: boolean };
export function MemberPlanCard() {
  const { t } = useTranslation(); const lang = useLang(); const { userId } = useGatherwell();
  const { data: ws } = useQuery(workspaceQuery(userId));
  const { data } = useQuery({
    queryKey: ['member-plan', userId, ws?.teamId], enabled: !!ws?.teamId, refetchOnWindowFocus: true,
    queryFn: async () => { const { data } = await supabase.rpc('get_member_plan', { _team: ws!.teamId }); return data as unknown as { created_at: string; items: PlanItem[] } | null; },
  });
  if (!data?.items?.length) return null;
  const done = data.items.filter(i => i.done).length; const total = data.items.length;
  const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(data.created_at).getTime()) / 864e5));
  const title = (i: PlanItem) => (lang === 'es' ? i.title_es || i.title_en : i.title_en) ?? '';
  const label = (i: PlanItem) => i.kind === 'introduce' ? t('smart.plan.introduce') : t(`smart.plan.${i.kind}`, { title: title(i) });
  const to = (i: PlanItem) => i.kind === 'lesson' ? `/learn/lesson/${i.ref}` : i.kind === 'rsvp' ? `/event/${i.ref}` : i.kind === 'template' ? '/events' : '/team';
  return <section className="panel plan-card" aria-labelledby="plan-h">
    <div className="section-heading"><div><span className="eyebrow">{t('smart.plan.eyebrow', { days: daysLeft })}</span><h2 id="plan-h">{t('smart.plan.title')}</h2></div><span className="plan-count">{t('smart.plan.progress', { done, total })}</span></div>
    <progress className="attendance-progress" value={done} max={total} aria-label={t('smart.plan.progress', { done, total })} />
    <ul className="plan-list">{data.items.map((i, n) => <li key={n} className={i.done ? 'is-done' : ''}><a href={to(i)}>{i.done ? <CircleCheck /> : <Circle />}<span>{label(i)}</span>{!i.done && <ArrowRight />}</a></li>)}</ul>
  </section>;
}

/* ---------------- Follow-up inbox ---------------- */

type Draft = { id: string; event_id: string; guest_name: string; language: string; kind: 'first_time' | 'returning' | 'no_show'; message: string; status: 'draft' | 'approved' | 'sent' | 'skipped'; channel: string | null; preview: boolean; events: { title: string; starts_at: string } | null; rsvps: { guest_phone: string | null; guest_email: string | null; email_opt_in: boolean; sms_opt_in: boolean } | null };

const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;

function DraftCard({ d, onChanged }: { d: Draft; onChanged: () => void }) {
  const { t } = useTranslation(); const sendRaw = useServerFn(sendFollowup); const send: typeof sendRaw = async a => { const r = await sendRaw(a); trackEvent('followup_sent'); return r; };
  const [edit, setEdit] = useState(false); const [msg, setMsg] = useState(d.message); const [busy, setBusy] = useState(false);
  useEffect(() => setMsg(d.message), [d.message]);
  const r = d.rsvps; const canEmail = !!(r?.email_opt_in && r.guest_email); const canSms = !!(r?.sms_opt_in && r.guest_phone);
  const done = d.status === 'sent' || d.status === 'skipped';
  const update = async (patch: Partial<Pick<Draft, 'status' | 'message'>>) => {
    const { error } = await supabase.from('followup_drafts').update(patch).eq('id', d.id);
    if (error) { toast.error(t(error.message.includes('claim') ? 'smart.claims.blocked' : 'profile.saveError')); return false; }
    onChanged(); return true;
  };
  const go = async (channel: 'email' | 'sms' | 'whatsapp') => {
    if (hasBlockedClaim(msg)) { toast.error(t('smart.claims.blocked')); return; }
    if (channel === 'whatsapp' && r?.guest_phone) window.open(waLink(r.guest_phone, msg), '_blank', 'noopener');
    setBusy(true);
    try {
      const res = await send({ data: { draftId: d.id, channel, message: msg } });
      if (!res.ok) { toast.error(t(`smart.followups.err.${res.error}`, { defaultValue: t('profile.saveError') })); return; }
      toast.success(t(`smart.followups.sentVia.${channel}`)); onChanged();
    } finally { setBusy(false); }
  };
  return <article className={`panel followup-card ${done ? 'is-done' : ''}`}>
    <div className="followup-head"><strong>{d.guest_name || t('smart.followups.guest')}</strong>
      <span className={`chip kind-${d.kind}`}>{t(`smart.followups.kind.${d.kind}`)}</span><span className="chip quiet-chip">{d.language.toUpperCase()}</span>
      {d.status !== 'draft' && <span className="chip">{t(`smart.followups.status.${d.status}`)}{d.channel ? ` · ${t(`smart.followups.channel.${d.channel}`)}` : ''}</span>}</div>
    {edit ? <><Textarea rows={5} maxLength={1000} className="field-textarea" value={msg} onChange={e => setMsg(e.target.value)} aria-label={t('smart.followups.message')} /><ClaimGuard text={msg} onUse={setMsg} lang={d.language === 'es' ? 'es' : 'en'} />
      <div className="as-actions"><Button size="sm" onClick={async () => { if (await update({ message: msg })) setEdit(false); }}><Check />{t('smart.save')}</Button><Button size="sm" variant="ghost" onClick={() => { setMsg(d.message); setEdit(false); }}>{t('smart.cancel')}</Button></div></>
      : <p className="followup-msg">{msg}</p>}
    {!done && !edit && <div className="followup-actions">
      <Button size="sm" variant="secondary" onClick={() => setEdit(true)}><Pencil />{t('smart.followups.edit')}</Button>
      {d.status === 'draft' ? <Button size="sm" variant="secondary" onClick={() => update({ status: 'approved' })}><Check />{t('smart.followups.approve')}</Button> : <Button size="sm" variant="ghost" onClick={() => update({ status: 'draft' })}>{t('smart.followups.unapprove')}</Button>}
      {canEmail && <Button size="sm" variant="secondary" disabled={busy} onClick={() => go('email')}><Mail />{t('smart.followups.email')}</Button>}
      {canSms && <Button size="sm" variant="secondary" disabled={busy} onClick={() => go('sms')}><MessageSquareText />{t('smart.followups.text')}</Button>}
      {r?.guest_phone && <Button size="sm" disabled={busy} onClick={() => go('whatsapp')}><MessageCircle />{t('smart.followups.whatsapp')}</Button>}
      <Button size="sm" variant="ghost" onClick={() => update({ status: 'skipped' })}>{t('smart.followups.skip')}</Button>
    </div>}
  </article>;
}

export function FollowupInbox() {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const qc = useQueryClient();
  const sendRaw = useServerFn(sendFollowup); const send: typeof sendRaw = async a => { const r = await sendRaw(a); trackEvent('followup_sent'); return r; }; const prepare = useServerFn(prepareFollowupsNow);
  const key = ['followups', userId];
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: [...key, 'list'], queryFn: async () => {
      const { data, error } = await supabase.from('followup_drafts').select('id, event_id, guest_name, language, kind, message, status, channel, preview, events(title, starts_at), rsvps(guest_phone, guest_email, email_opt_in, sms_opt_in)').or(await scopeFilter(userId)).order('created_at', { ascending: false }).limit(200);
      if (error) throw error; return data as unknown as Draft[];
    },
  });
  const { data: past = [] } = useQuery({
    queryKey: [...key, 'past'], queryFn: async () => {
      const { data } = await supabase.from('events').select('id, title, starts_at').eq('host_id', userId).neq('status', 'cancelled').lt('starts_at', new Date().toISOString()).gt('starts_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('starts_at', { ascending: false }).limit(10);
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const approved = drafts.filter(d => d.status === 'approved');
  const sendAll = async () => {
    const list = approved.filter(d => (d.rsvps?.email_opt_in && d.rsvps.guest_email) || (d.rsvps?.sms_opt_in && d.rsvps.guest_phone));
    if (!list.length) { toast(t('smart.followups.noneSendable')); return; }
    setProgress({ done: 0, total: list.length }); let ok = 0;
    for (const [i, d] of list.entries()) {
      const channel = d.rsvps?.email_opt_in && d.rsvps.guest_email ? 'email' : 'sms';
      try { const r = await send({ data: { draftId: d.id, channel, message: d.message } }); if (r.ok) ok++; } catch { /* keep going */ }
      setProgress({ done: i + 1, total: list.length });
    }
    toast.success(t('smart.followups.sentAll', { count: ok })); setProgress(null);
    if (approved.length > list.length) toast(t('smart.followups.whatsappLeft', { count: approved.length - list.length }));
    await refresh();
  };
  const groups = useMemo(() => { const m = new Map<string, Draft[]>(); for (const d of drafts) m.set(d.event_id, [...(m.get(d.event_id) ?? []), d]); return [...m.values()]; }, [drafts]);
  const withDrafts = new Set(drafts.map(d => d.event_id));
  const fmt = (iso: string) => new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(iso));
  const anyPreview = drafts.some(d => d.preview);
  return <>
    <Link to="/home" className="auth-link back-link"><ArrowLeft />{t('nav.home')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('smart.followups.eyebrow')}</span><h1>{t('smart.followups.title')}</h1><p>{t('smart.followups.subtitle')}</p></div>
      {anyPreview && <span className="chip quiet-chip">{t('assistant.previewMode')}</span>}</div>
    {approved.length > 0 && <div className="followup-sendall"><Button disabled={!!progress} onClick={sendAll}><Check />{t('smart.followups.sendAll', { count: approved.length })}</Button>
      {progress && <><progress className="attendance-progress" value={progress.done} max={progress.total} /><small>{t('smart.followups.progress', progress)}</small></>}</div>}
    {isLoading ? <ListSkeleton /> : groups.length === 0 && <section className="panel"><EmptyState compact icon="MessageSquareText" text={t('smart.followups.empty')} /></section>}
    {groups.map(g => <section key={g[0]!.event_id} className="followup-group"><h2>{g[0]!.events?.title}<small>{g[0]!.events ? fmt(g[0]!.events.starts_at) : ''}</small></h2>
      {g.map(d => <DraftCard key={d.id} d={d} onChanged={refresh} />)}</section>)}
    {past.filter(e => !withDrafts.has(e.id)).length > 0 && <section className="panel"><h2>{t('smart.followups.prepareTitle')}</h2><p className="auth-subtitle">{t('smart.followups.prepareText')}</p>
      {past.filter(e => !withDrafts.has(e.id)).map(e => <div key={e.id} className="person-row prepare-row"><div className="person-info"><h3>{e.title}</h3><p>{fmt(e.starts_at)}</p></div>
        <Button size="sm" variant="secondary" onClick={async () => { const r = await prepare({ data: { eventId: e.id } }); if (!r.ok) { toast.error(t('profile.saveError')); return; } toast.success(r.created ? t('smart.followups.prepared', { count: r.created }) : t('smart.followups.noGuests')); await refresh(); }}>{t('smart.followups.prepare')}</Button></div>)}</section>}
  </>;
}

/* ---------------- Lesson summary ---------------- */

type Sum = { summary_en: string; summary_es: string; points_en: string[]; points_es: string[]; actions_en: string[]; actions_es: string[]; published?: boolean };

export function LessonSummary({ lessonId, leader }: { lessonId: string; leader: boolean }) {
  const { t } = useTranslation(); const lang = useLang(); const qc = useQueryClient(); const fn = useServerFn(summarizeLesson);
  const key = ['lesson-summary', lessonId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from('lesson_summaries').select('*').eq('lesson_id', lessonId).maybeSingle()).data as (Sum & { team_id: string; published: boolean }) | null });
  const [open, setOpen] = useState(false); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<(Sum & { team_id: string }) | null>(null); const [preview, setPreview] = useState(false); const [fail, setFail] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fn({ data: { lessonId, notes } });
      if (!r.ok) { setFail(r.error); return; }
      setFail(null);
      setDraft({ ...r.summary, team_id: r.teamId }); setPreview(r.preview);
    } finally { setBusy(false); }
  };
  const save = async (published: boolean) => {
    if (!draft) return;
    const clean = (a: string[]) => a.map(x => x.trim()).filter(Boolean);
    const row = { lesson_id: lessonId, team_id: draft.team_id, summary_en: draft.summary_en.trim(), summary_es: draft.summary_es.trim(), points_en: clean(draft.points_en), points_es: clean(draft.points_es), actions_en: clean(draft.actions_en), actions_es: clean(draft.actions_es), published };
    const { error } = await supabase.from('lesson_summaries').upsert(row);
    if (error) { toast.error(t(error.message.includes('claim') ? 'smart.claims.blocked' : 'profile.saveError')); return; }
    toast.success(t(published ? 'smart.summary.published' : 'smart.summary.saved')); setDraft(null); setOpen(false); await qc.invalidateQueries({ queryKey: key });
  };
  const shown = data && (data.published || leader) ? data : null;
  const L = <T,>(en: T, es: T) => (lang === 'es' ? es : en);
  return <>
    {shown && !draft && <section className="panel lesson-summary"><div className="section-heading"><h2>{t('smart.summary.title')}</h2>{!data!.published && <span className="chip quiet-chip">{t('smart.summary.unpublished')}</span>}</div>
      <p>{L(shown.summary_en, shown.summary_es || shown.summary_en)}</p>
      <h3>{t('smart.summary.points')}</h3><ol>{L(shown.points_en, shown.points_es).map((p, i) => <li key={i}>{p}</li>)}</ol>
      <h3>{t('smart.summary.actions')}</h3><ul className="summary-actions">{L(shown.actions_en, shown.actions_es).map((p, i) => <li key={i}><Check />{p}</li>)}</ul>
      {leader && <Button variant="secondary" size="sm" onClick={() => setDraft({ ...shown })}><Pencil />{t('smart.summary.edit')}</Button>}</section>}
    {leader && !draft && <div className="summary-cta">{!open ? <Button variant="secondary" onClick={() => setOpen(true)}>{t(shown ? 'smart.summary.redo' : 'smart.summary.summarize')}</Button>
      : <section className="panel"><h2>{t('smart.summary.summarize')}</h2><p className="auth-subtitle">{t('smart.summary.pasteHint')}</p>
        <p className="field-hint">{t('smart.summary.filesNote')}</p>
        <Textarea rows={6} maxLength={30000} className="field-textarea" value={notes} onChange={e => { setNotes(e.target.value); setFail(null); }} aria-label={t('smart.summary.notes')} placeholder={t('smart.summary.notesPlaceholder')} />
        {fail && <p className="field-error" role="alert">{t(fail === 'limit' ? 'assistant.limitReached' : fail === 'no_source' ? 'smart.summary.noSource' : fail === 'too_short' ? 'smart.summary.tooShort' : fail === 'unavailable' ? 'smart.summary.unavailable' : 'smart.summary.failed')}</p>}
        <div className="as-actions"><Button disabled={busy} onClick={run}>{busy ? t('smart.summary.working') : t('smart.summary.summarize')}</Button><Button variant="ghost" onClick={() => setOpen(false)}>{t('smart.cancel')}</Button></div></section>}</div>}
    {draft && <section className="panel summary-editor"><div className="section-heading"><h2>{t('smart.summary.review')}</h2>{preview && <span className="chip quiet-chip">{t('assistant.previewMode')}</span>}</div>
      {(['en', 'es'] as const).map(l => <div key={l} className="summary-lang"><span className="gw-label">{l.toUpperCase()}</span>
        <Textarea rows={3} className="field-textarea" value={draft[`summary_${l}`]} aria-label={`${t('smart.summary.title')} ${l}`} onChange={e => setDraft({ ...draft, [`summary_${l}`]: e.target.value })} />
        <ClaimGuard text={draft[`summary_${l}`]} lang={l} onUse={v => setDraft({ ...draft, [`summary_${l}`]: v })} />
        <span className="field-label">{t('smart.summary.points')}</span>{draft[`points_${l}`].map((p, i) => <Input key={i} className="field-input" value={p} aria-label={`${t('smart.summary.points')} ${i + 1}`} onChange={e => { const a = [...draft[`points_${l}`]]; a[i] = e.target.value; setDraft({ ...draft, [`points_${l}`]: a }); }} />)}
        <span className="field-label">{t('smart.summary.actions')}</span>{draft[`actions_${l}`].map((p, i) => <Input key={i} className="field-input" value={p} aria-label={`${t('smart.summary.actions')} ${i + 1}`} onChange={e => { const a = [...draft[`actions_${l}`]]; a[i] = e.target.value; setDraft({ ...draft, [`actions_${l}`]: a }); }} />)}
      </div>)}
      <div className="as-actions wrap"><Button onClick={() => save(true)}>{t('smart.summary.publish')}</Button><Button variant="secondary" onClick={() => save(false)}>{t('smart.summary.saveDraft')}</Button><Button variant="ghost" onClick={() => setDraft(null)}>{t('smart.cancel')}</Button></div>
    </section>}
  </>;
}
