import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera, Check, CloudSun, EyeOff, Eye, Lock, Plus, Trash2, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { getWeather, listEventPhotos, uploadEventPhoto } from '@/lib/event-day.functions';

export type LiveCounts = { going: number; checked_in: number; walk_ins: number; waitlist: number };

/** Realtime subscription to a gathering's counts table; calls onChange within ~1–2s of any RSVP change. */
export function useLiveCounts(eventId: string, onChange?: () => void) {
  const queryClient = useQueryClient();
  const cb = useRef(onChange); cb.current = onChange;
  const q = useQuery({
    queryKey: ['live-counts', eventId],
    queryFn: async (): Promise<LiveCounts | null> => (await supabase.from('event_live_counts').select('going, checked_in, walk_ins, waitlist').eq('event_id', eventId).maybeSingle()).data,
  });
  useEffect(() => {
    const channel = supabase.channel(`live-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_live_counts', filter: `event_id=eq.${eventId}` }, payload => {
        if (payload.new && 'going' in payload.new) queryClient.setQueryData(['live-counts', eventId], payload.new as LiveCounts);
        cb.current?.();
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient]);
  return q.data ?? null;
}

/** Realtime on the rsvps table (host/leader only through RLS). */
export function useRsvpChanges(eventId: string, onChange: () => void) {
  const cb = useRef(onChange); cb.current = onChange;
  useEffect(() => {
    const channel = supabase.channel(`rsvps-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` }, () => cb.current())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId]);
}

type Poll = { id: string; question: string; closed: boolean; options: { id: string; label: string; votes: number; position: number }[] };

export function Polls({ eventId, code, manage = false }: { eventId: string; code?: string | null; manage?: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const key = ['polls', eventId];
  const { data: polls = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Poll[]> => {
      const { data } = await supabase.from('event_polls').select('id, question, closed, created_at, event_poll_options(id, label, votes, position)').eq('event_id', eventId).order('created_at');
      return (data ?? []).map(p => ({ id: p.id, question: p.question, closed: p.closed, options: [...(p.event_poll_options ?? [])].sort((a, b) => a.position - b.position) }));
    },
  });
  const { data: mine = [] } = useQuery({
    queryKey: ['poll-votes', eventId, code], enabled: !!code,
    queryFn: async () => (await supabase.rpc('my_poll_votes', { _code: code!, _event: eventId })).data ?? [],
  });
  useEffect(() => {
    const channel = supabase.channel(`polls-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_poll_options', filter: `event_id=eq.${eventId}` }, () => void queryClient.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
  const [creating, setCreating] = useState(false);
  const vote = async (optionId: string) => {
    if (!code) return;
    const { error } = await supabase.rpc('vote_poll', { _code: code, _option: optionId });
    if (error) { toast.error(t(error.message.includes('already_voted') ? 'live.alreadyVoted' : error.message.includes('poll_closed') ? 'live.pollClosed' : 'guest.errors.generic')); return; }
    await queryClient.invalidateQueries({ queryKey: ['poll-votes', eventId, code] }); await queryClient.invalidateQueries({ queryKey: key });
  };
  const close = async (id: string, closed: boolean) => { await supabase.from('event_polls').update({ closed }).eq('id', id); await queryClient.invalidateQueries({ queryKey: key }); };
  const remove = async (id: string) => { await supabase.from('event_polls').delete().eq('id', id); await queryClient.invalidateQueries({ queryKey: key }); };
  if (!polls.length && !manage) return null;
  return <section className="live-section">
    <div className="live-heading"><h2>{t('live.polls')}</h2>{manage && <Button size="sm" variant="secondary" onClick={() => setCreating(true)}><Plus />{t('live.addPoll')}</Button>}</div>
    {!polls.length && <p className="muted">{t('live.noPolls')}</p>}
    {polls.map(p => {
      const voted = mine.find(v => v.poll_id === p.id)?.option_id;
      const total = p.options.reduce((n, o) => n + o.votes, 0);
      const showResults = !!voted || p.closed || manage || !code;
      return <div key={p.id} className="poll-card">
        <div className="poll-head"><strong>{p.question}</strong>{p.closed && <span className="chip"><Lock className="inline-icon" />{t('live.closed')}</span>}</div>
        <ul className="poll-options">{p.options.map(o => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          return <li key={o.id}>{showResults
            ? <div className={`poll-result ${voted === o.id ? 'is-mine' : ''}`}><span className="poll-bar" style={{ width: `${pct}%` }} /><span className="poll-label">{voted === o.id && <Check className="inline-icon" />}{o.label}</span><span className="tabular-nums">{pct}%</span></div>
            : <button type="button" className="poll-choice" onClick={() => vote(o.id)}>{o.label}</button>}</li>;
        })}</ul>
        <p className="muted tabular-nums">{t('live.votes', { count: total })}{!code && !manage && !p.closed && ` · ${t('live.rsvpToVote')}`}</p>
        {manage && <div className="poll-manage"><Button size="sm" variant="ghost" onClick={() => close(p.id, !p.closed)}>{p.closed ? t('live.reopen') : t('live.close')}</Button><Button size="sm" variant="ghost" className="danger-text" onClick={() => remove(p.id)}><Trash2 />{t('live.delete')}</Button></div>}
      </div>;
    })}
    {manage && <PollEditor open={creating} eventId={eventId} onClose={() => setCreating(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: key })} />}
  </section>;
}

function PollEditor({ open, eventId, onClose, onSaved }: { open: boolean; eventId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(''); const [opts, setOpts] = useState(['', '']); const [busy, setBusy] = useState(false);
  const save = async () => {
    const options = opts.map(o => o.trim()).filter(Boolean);
    if (!q.trim() || options.length < 2) { toast.error(t('live.pollInvalid')); return; }
    setBusy(true); const { error } = await supabase.rpc('create_poll', { _event: eventId, _question: q.trim(), _options: options }); setBusy(false);
    if (error) { toast.error(t('guest.errors.generic')); return; }
    setQ(''); setOpts(['', '']); onSaved(); onClose();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('live.addPoll')}>
    <div className="guest-form">
      <div><label className="field-label" htmlFor="poll-q">{t('live.question')}</label><Input id="poll-q" maxLength={200} placeholder={t('live.questionExample')} className="field-input" value={q} onChange={e => setQ(e.target.value)} /></div>
      {opts.map((o, i) => <div key={i} className="poll-option-row"><Input aria-label={t('live.option', { n: i + 1 })} placeholder={t('live.option', { n: i + 1 })} maxLength={80} className="field-input" value={o} onChange={e => setOpts(opts.map((x, j) => j === i ? e.target.value : x))} />
        {opts.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={t('live.removeOption')} onClick={() => setOpts(opts.filter((_, j) => j !== i))}><X /></Button>}</div>)}
      {opts.length < 5 && <Button type="button" variant="secondary" onClick={() => setOpts([...opts, ''])}><Plus />{t('live.addOption')}</Button>}
      <Button className="guest-primary" disabled={busy} onClick={save}>{t('live.publishPoll')}</Button>
    </div>
  </ResponsiveSheet>;
}

async function compress(file: File) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export function PhotoRoll({ eventId, code, canAdd }: { eventId: string; code?: string | null; canAdd: boolean }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const list = useServerFn(listEventPhotos); const upload = useServerFn(uploadEventPhoto);
  const { data } = useQuery({ queryKey: ['photos', eventId], queryFn: () => list({ data: { eventId } }) });
  const [busy, setBusy] = useState(false); const input = useRef<HTMLInputElement>(null);
  if (!data || (!data.open && !data.manage) || (!data.photos.length && !canAdd && !data.manage)) return null;
  const onFile = async (file?: File) => {
    if (!file) return; setBusy(true);
    try {
      const res = await upload({ data: { eventId, code: code ?? undefined, dataUrl: await compress(file) } });
      if (!res.ok) toast.error(t(`live.photoErrors.${res.error}`, { defaultValue: t('guest.errors.generic') }));
      else { toast.success(t('live.photoAdded')); await queryClient.invalidateQueries({ queryKey: ['photos', eventId] }); }
    } catch { toast.error(t('guest.errors.generic')); }
    setBusy(false); if (input.current) input.current.value = '';
  };
  const toggleHidden = async (id: string, hidden: boolean) => { await supabase.from('event_photos').update({ hidden }).eq('id', id); await queryClient.invalidateQueries({ queryKey: ['photos', eventId] }); };
  return <section className="live-section">
    <div className="live-heading"><h2>{t('live.photos')}</h2>{(canAdd || data.manage) && data.open && <>
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><Camera />{busy ? t('guest.saving') : t('live.addPhoto')}</Button></>}</div>
    {!data.open && <p className="muted">{t('live.photosLater')}</p>}
    {data.open && !data.photos.length && <p className="muted">{t('live.noPhotos')}</p>}
    {data.photos.length > 0 && <ul className="photo-grid">{data.photos.map(p => <li key={p.id} className={p.hidden ? 'is-hidden' : ''}>
      <img src={p.url!} alt={t('live.photoAlt')} loading="lazy" />
      {data.manage && <button type="button" className="photo-hide" aria-label={p.hidden ? t('live.show') : t('live.hide')} onClick={() => toggleHidden(p.id, !p.hidden)}>{p.hidden ? <Eye /> : <EyeOff />}</button>}
    </li>)}</ul>}
  </section>;
}

const WEATHER: Array<[number, string]> = [[0, 'clear'], [3, 'cloudy'], [48, 'fog'], [67, 'rain'], [77, 'snow'], [82, 'rain'], [86, 'snow'], [99, 'storm']];

export function WeatherNote({ lat, lng, startsAt }: { lat: number | null; lng: number | null; startsAt: string }) {
  const { t, i18n } = useTranslation();
  const weather = useServerFn(getWeather);
  const sameDay = new Date(startsAt).toDateString() === new Date().toDateString();
  const { data } = useQuery({ queryKey: ['weather', lat, lng, startsAt], enabled: sameDay && lat != null && lng != null, staleTime: 30 * 60 * 1000, queryFn: () => weather({ data: { lat: lat!, lng: lng!, at: new Date(startsAt).toISOString() } }) });
  if (!data) return null;
  const kind = WEATHER.find(([max]) => data.code <= max)?.[1] ?? 'cloudy';
  const f = i18n.resolvedLanguage !== 'es';
  const temp = f ? `${Math.round(data.tempC * 9 / 5 + 32)}°F` : `${data.tempC}°C`;
  return <p className="weather-note"><CloudSun />{t('live.weather', { temp, conditions: t(`live.conditions.${kind}`) })}</p>;
}
