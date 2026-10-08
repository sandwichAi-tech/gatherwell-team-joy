import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { supabase } from '@/integrations/supabase/client';
import { getChannelStatus } from '@/lib/notify.functions';

const mask = (p: string) => p.length > 4 ? `•••• ${p.slice(-4)}` : p;

/** Host tool: text a gathering invite to opted-in people; they reply IN / SI to save a spot. */
export function TextInvitePanel({ eventId, title, startsAt, timezone }: { eventId: string; title: string; startsAt: string; timezone: string | null }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const statusFn = useServerFn(getChannelStatus);
  const { data: status } = useQuery({ queryKey: ['channel-status'], queryFn: () => statusFn(), staleTime: 300000, enabled: open });
  const { data: people = [], isLoading } = useQuery({ queryKey: ['text-invite', eventId], enabled: open, queryFn: async () => {
    const { data, error } = await supabase.rpc('text_invite_candidates', { _event: eventId }); if (error) throw error; return data ?? []; } });
  const { data: replies = 0 } = useQuery({ queryKey: ['text-invite-replies', eventId], queryFn: async () => {
    const { count } = await supabase.from('sms_invites').select('id', { count: 'exact', head: true }).eq('event_id', eventId).not('reply', 'is', null); return count ?? 0; } });
  const fresh = people.filter(p => !p.invited);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone || undefined }).format(new Date(startsAt));
  const send = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('send_text_invites', { _event: eventId, _phones: picked });
    setBusy(false);
    if (error) { toast.error(t('textInvite.error')); return; }
    toast.success(t('textInvite.sent', { count: data ?? 0 })); setPicked([]); setOpen(false);
    void qc.invalidateQueries({ queryKey: ['text-invite', eventId] });
  };
  return <>
    <section className="panel text-invite-panel"><div className="section-heading"><div><h2>{t('textInvite.title')}</h2><p>{t('textInvite.body')}</p></div></div>
      {replies > 0 && <p className="muted-copy">{t('textInvite.replies', { count: replies })}</p>}
      <Button variant="secondary" onClick={() => setOpen(true)}><GwIcon name="MessageSquareText" />{t('textInvite.open')}</Button></section>
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('textInvite.title')} description={title}
      footer={<Button className="w-full" disabled={busy || !picked.length} onClick={send}>{t('textInvite.send', { count: picked.length })}</Button>}>
      {status && !status.sms && <p className="not-connected-note">{t('textInvite.notConnected')}</p>}
      <div className="text-invite-preview"><span className="field-label">{t('textInvite.preview')}</span><p>{t('textInvite.previewText', { host: '', title, date }).trim()}</p></div>
      {isLoading ? <p className="muted-copy">…</p> : !people.length ? <div className="empty-panel"><GwFeatureTile name="MessageSquareText" /><p className="muted-copy">{t('textInvite.empty')}</p></div> : <>
        {fresh.length > 1 && <label className="text-invite-row"><Checkbox checked={picked.length === fresh.length} onCheckedChange={v => setPicked(v ? fresh.map(p => p.phone) : [])} /><span><strong>{t('textInvite.selectAll')}</strong></span></label>}
        <ul className="text-invite-list">{people.map(p => <li key={p.phone}><label className="text-invite-row">
          <Checkbox disabled={p.invited} checked={picked.includes(p.phone)} onCheckedChange={v => setPicked(v ? [...picked, p.phone] : picked.filter(x => x !== p.phone))} />
          <span><strong>{p.name || mask(p.phone)}</strong><small>{mask(p.phone)}</small></span>{p.invited && <span className="chip">{t('textInvite.invited')}</span>}
        </label></li>)}</ul></>}
    </ResponsiveSheet>
  </>;
}
