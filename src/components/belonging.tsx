import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HandHeart, Layers, PartyPopper, Plus, Sparkles, Star, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }>; from: (t: string) => any };

export type Belonging = { first_time: boolean; checkins: number; regular: boolean };
export type BelongRow = { id: string; guest_name: string | null; wants_buddy?: boolean; buddy_rsvp_id?: string | null; small_group?: string | null };
const first = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] || '';

export function useBelonging(eventId: string) {
  return useQuery({
    queryKey: ['event', eventId, 'belonging'],
    queryFn: async () => {
      const { data, error } = await db.rpc('rsvp_belonging', { _event: eventId });
      if (error) return new Map<string, Belonging>();
      return new Map<string, Belonging>(((data ?? []) as (Belonging & { rsvp_id: string })[]).map(b => [b.rsvp_id, b]));
    },
  });
}

export function useSmallGroups(eventId: string) {
  return useQuery({ queryKey: ['event', eventId, 'small-groups'], queryFn: async () => ((await db.from('events').select('small_groups').eq('id', eventId).maybeSingle()).data?.small_groups ?? []) as string[] });
}

/** Chips shown next to a guest's name on the guest list and check-in screen. */
export function BelongingTags({ info, row, rows }: { info?: Belonging; row: BelongRow; rows: BelongRow[] }) {
  const { t } = useTranslation();
  const buddy = row.buddy_rsvp_id ? rows.find(r => r.id === row.buddy_rsvp_id) : null;
  return <>
    {info?.first_time && <span className="chip belong-chip is-first"><Sparkles />{t('belong.firstTime')}</span>}
    {info?.regular && <span className="chip belong-chip is-regular"><Star />{t('belong.regular')}</span>}
    {row.wants_buddy && !buddy && <span className="chip belong-chip"><HandHeart />{t('belong.wantsBuddy')}</span>}
    {buddy && <span className="chip belong-chip"><HandHeart />{t('belong.buddyWith', { name: first(buddy.guest_name) })}</span>}
    {row.small_group && <span className="chip belong-chip"><Layers />{row.small_group}</span>}
  </>;
}

/** A gentle prompt for the host: welcome first-timers, celebrate new regulars. */
export function BelongingPrompt({ info, name }: { info?: Belonging; name: string | null }) {
  const { t } = useTranslation();
  if (!info) return null;
  if (info.first_time) return <p className="belong-prompt"><Sparkles />{t('belong.welcomePrompt', { name: first(name) || t('teamSpace.someone') })}</p>;
  if (info.regular && info.checkins === 3) return <p className="belong-prompt is-celebrate"><PartyPopper />{t('belong.celebratePrompt', { name: first(name) || t('teamSpace.someone') })}</p>;
  return null;
}

/** Host pairs a guest with a regular (or anyone) for this gathering. */
export function BuddySheet({ eventId, row, rows, info, onClose }: { eventId: string; row: BelongRow; rows: BelongRow[]; info: Map<string, Belonging>; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const options = rows.filter(r => r.id !== row.id).sort((a, b) => Number(!!info.get(b.id)?.regular) - Number(!!info.get(a.id)?.regular) || (b.wants_buddy ? 0 : 1) - (a.wants_buddy ? 0 : 1));
  const pair = async (buddy: string | null) => {
    setBusy(true); const { error } = await db.rpc('pair_buddy', { _rsvp: row.id, _buddy: buddy }); setBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t(buddy ? 'belong.paired' : 'belong.unpaired')); await qc.invalidateQueries({ queryKey: ['event', eventId] }); onClose();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('belong.pairTitle', { name: first(row.guest_name) })} description={t('belong.pairHint')}>
    <ul className="belong-pick">
      {row.buddy_rsvp_id && <li><Button variant="ghost" className="danger-text" disabled={busy} onClick={() => pair(null)}><X />{t('belong.unpair')}</Button></li>}
      {options.map(o => <li key={o.id}><button type="button" disabled={busy} className={`belong-option ${o.id === row.buddy_rsvp_id ? 'is-active' : ''}`} onClick={() => pair(o.id)}>
        <strong>{o.guest_name ?? t('teamSpace.someone')}</strong>
        <span className="muted">{info.get(o.id)?.regular ? t('belong.visits', { count: info.get(o.id)!.checkins }) : info.get(o.id)?.first_time ? t('belong.firstTime') : ''}</span>
      </button></li>)}
      {!options.length && <li className="muted">{t('belong.noOptions')}</li>}
    </ul>
  </ResponsiveSheet>;
}

/** Host sets up small groups (pace groups, tables) and assigns people. */
export function SmallGroupsSheet({ eventId, rows, onClose }: { eventId: string; rows: BelongRow[]; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data: saved = [] } = useSmallGroups(eventId);
  const [groups, setGroups] = useState<string[]>([]); const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => setGroups(saved), [saved]);
  const saveGroups = async (next: string[]) => {
    setGroups(next); setBusy(true);
    const { error } = await db.rpc('set_small_groups', { _event: eventId, _groups: next }); setBusy(false);
    if (error) toast.error(t('profile.saveError'));
    await qc.invalidateQueries({ queryKey: ['event', eventId] });
  };
  const assign = async (rid: string, g: string) => {
    const { error } = await db.rpc('assign_small_group', { _rsvp: rid, _group: g || null });
    if (error) { toast.error(t('profile.saveError')); return; }
    await qc.invalidateQueries({ queryKey: ['event', eventId] });
  };
  const autoSplit = async () => {
    if (!groups.length) return; setBusy(true);
    await Promise.all(rows.map((r, i) => db.rpc('assign_small_group', { _rsvp: r.id, _group: groups[i % groups.length] })));
    setBusy(false); toast.success(t('belong.split')); await qc.invalidateQueries({ queryKey: ['event', eventId] });
  };
  const add = () => { const v = draft.trim().slice(0, 40); if (!v || groups.includes(v) || groups.length >= 12) return; setDraft(''); void saveGroups([...groups, v]); };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('belong.groupsTitle')} description={t('belong.groupsHint')}
    footer={<Button variant="secondary" disabled={busy || !groups.length || !rows.length} onClick={autoSplit}><Layers />{t('belong.autoSplit')}</Button>}>
    <form className="belong-add" onSubmit={e => { e.preventDefault(); add(); }}>
      <label className="sr-only" htmlFor="sg-new">{t('belong.groupName')}</label>
      <Input id="sg-new" className="field-input" maxLength={40} placeholder={t('belong.groupPlaceholder')} value={draft} onChange={e => setDraft(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={busy || !draft.trim()}><Plus />{t('belong.addGroup')}</Button>
    </form>
    {!!groups.length && <div className="belong-groups">{groups.map(g => <span key={g} className="chip belong-chip"><Layers />{g}<button type="button" aria-label={t('belong.removeGroup', { name: g })} onClick={() => saveGroups(groups.filter(x => x !== g))}><X /></button></span>)}</div>}
    {!!groups.length && <ul className="belong-assign">{rows.map(r => <li key={r.id}>
      <label htmlFor={`sg-${r.id}`}>{r.guest_name ?? t('teamSpace.someone')}</label>
      <select id={`sg-${r.id}`} className="field-input" value={r.small_group ?? ''} onChange={e => assign(r.id, e.target.value)}>
        <option value="">{t('belong.noGroup')}</option>{groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
    </li>)}</ul>}
  </ResponsiveSheet>;
}

/** Guest side: "What to expect" for first-timers + "I'd like a buddy". */
export function GuestBelonging({ code, status }: { code: string; status: string }) {
  const { t } = useTranslation();
  const { data, refetch } = useQuery({ queryKey: ['rsvp-first-time', code], queryFn: async () => (await db.rpc('rsvp_first_time', { _code: code })).data as { first_time: boolean; host: string; wants_buddy: boolean } | null });
  if (!data || !['going', 'maybe', 'waitlist', 'requested'].includes(status)) return null;
  const toggle = async (on: boolean) => {
    const { error } = await db.rpc('set_buddy_wish', { _code: code, _on: on });
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t(on ? 'belong.buddyAsked' : 'belong.buddyCleared')); void refetch();
  };
  return <div className="belong-guest">
    {data.first_time && <div className="belong-expect">
      <h3 className="guest-subhead"><Sparkles />{t('belong.expectTitle')}</h3>
      <p>{t('belong.expectIntro', { host: data.host || t('belong.yourHost') })}</p>
      <ul><li>{t('belong.expect1')}</li><li>{t('belong.expect2')}</li><li>{t('belong.expect3')}</li></ul>
    </div>}
    <label className="guest-consent"><Checkbox checked={data.wants_buddy} onCheckedChange={v => void toggle(!!v)} /><span><strong>{t('belong.buddyAsk')}</strong> {t('belong.buddyAskHint')}</span></label>
  </div>;
}

/** Member profile: hosts where you're a regular. */
export function RegularHosts() {
  const { t } = useTranslation();
  const { data = [] } = useQuery({ queryKey: ['my-regular-hosts'], queryFn: async () => ((await db.rpc('my_regular_hosts')).data ?? []) as { host_id: string; host_name: string | null; checkins: number }[] });
  if (!data.length) return null;
  return <section className="panel belong-regulars">
    <h2 className="section-title"><Star />{t('belong.regularAt')}</h2>
    <ul>{data.map(h => <li key={h.host_id}><span className="chip belong-chip is-regular"><Star />{t('belong.regular')}</span><strong>{h.host_name ?? t('teamSpace.someone')}</strong><span className="muted">{t('belong.visits', { count: h.checkins })}</span></li>)}</ul>
  </section>;
}
