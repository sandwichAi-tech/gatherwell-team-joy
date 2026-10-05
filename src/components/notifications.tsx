import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { profileQuery } from '@/lib/account';
import { getChannelStatus } from '@/lib/notify.functions';

type Prefs = { email: boolean; sms: boolean; push: boolean; reminders: boolean; announcements: boolean; badges: boolean; followups: boolean };
const DEFAULTS: Prefs = { email: true, sms: true, push: true, reminders: true, announcements: true, badges: true, followups: true };

export function useChannelStatus() {
  const fn = useServerFn(getChannelStatus);
  return useQuery({ queryKey: ['channel-status'], queryFn: () => fn(), staleTime: 5 * 60 * 1000 });
}

const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(b64: string) { const p = b64.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); }

export async function enablePush(pushKey: string, userId: string) {
  if (!pushSupported()) return 'unsupported' as const;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied' as const;
  const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey) });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.from('push_subscriptions').delete().eq('endpoint', json.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({ user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
  if (error) throw error;
  return 'enabled' as const;
}

// ---- Ask for push only after a meaningful moment ----
let pendingMoment: string | null = null;
export function requestPushMoment(reason: 'rsvp' | 'joined' | 'hosted') {
  pendingMoment = reason;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gatherwell:push-moment'));
}

export function PushPrompt({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: status } = useChannelStatus();
  const [reason, setReason] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const check = () => {
      if (!pendingMoment || !pushSupported() || Notification.permission !== 'default') { pendingMoment = null; return; }
      setReason(pendingMoment); pendingMoment = null;
    };
    check(); window.addEventListener('gatherwell:push-moment', check);
    return () => window.removeEventListener('gatherwell:push-moment', check);
  }, []);
  if (!reason || !status?.pushKey) return null;
  return <ResponsiveSheet open onOpenChange={o => !o && setReason(null)} title={t('notify.pushTitle')} description={t(`notify.pushWhy.${reason}`)}>
    <div className="edit-form">
      <p className="auth-subtitle">{t('notify.pushText')}</p>
      <div className="confirm-actions">
        <Button variant="secondary" onClick={() => setReason(null)}>{t('notify.notNow')}</Button>
        <Button disabled={busy} onClick={async () => { setBusy(true); try { const r = await enablePush(status.pushKey!, userId); if (r === 'enabled') toast.success(t('notify.pushOn')); } catch { toast.error(t('profile.saveError')); } setBusy(false); setReason(null); }}><Bell />{t('notify.turnOn')}</Button>
      </div>
    </div>
  </ResponsiveSheet>;
}

// ---- Me → Notifications ----
export function NotificationSettings({ userId }: { userId: string }) {
  const { t } = useTranslation(); const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: status } = useChannelStatus();
  const prefs: Prefs = { ...DEFAULTS, ...((profile as { notify_prefs?: Partial<Prefs> } | undefined)?.notify_prefs ?? {}) };
  const [device, setDevice] = useState<'on' | 'off' | 'blocked' | 'unsupported'>('off');
  useEffect(() => {
    if (!pushSupported()) { setDevice('unsupported'); return; }
    if (Notification.permission === 'denied') { setDevice('blocked'); return; }
    void navigator.serviceWorker.getRegistration('/').then(r => r?.pushManager.getSubscription()).then(s => setDevice(s ? 'on' : 'off'));
  }, []);
  const save = async (patch: Partial<Prefs>) => {
    const { error } = await supabase.from('profiles').update({ notify_prefs: { ...prefs, ...patch } }).eq('id', userId);
    if (error) toast.error(t('profile.saveError'));
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  };
  const connected: Record<'email' | 'sms' | 'push', boolean> = { email: !!status?.email, sms: !!status?.sms, push: !!status?.push };
  const channels = [{ key: 'email', Icon: Mail }, { key: 'sms', Icon: MessageSquare }, { key: 'push', Icon: Smartphone }] as const;
  return <div className="notify-settings">
    <span className="field-label">{t('notify.channels')}</span>
    <div className="settings-list">{channels.map(({ key, Icon }) => <label className="switch-row notify-row" key={key}>
      <Icon className="settings-icon" /><span><strong>{t(`notify.channel.${key}`)}</strong>{status && !connected[key] ? <small className="not-connected-badge">{t('common.notConnected')}</small> : <small>{t('notify.connected')}</small>}</span>
      <Switch checked={prefs[key]} onCheckedChange={v => void save({ [key]: v })} aria-label={t(`notify.channel.${key}`)} /></label>)}</div>
    {status?.pushKey && device !== 'unsupported' && <div className="notify-device">
      {device === 'on' ? <p className="auth-subtitle">{t('notify.deviceOn')}</p> : device === 'blocked' ? <p className="auth-subtitle">{t('notify.deviceBlocked')}</p>
        : <Button variant="secondary" onClick={async () => { try { const r = await enablePush(status.pushKey!, userId); if (r === 'enabled') { setDevice('on'); toast.success(t('notify.pushOn')); } else if (r === 'denied') setDevice('blocked'); } catch { toast.error(t('profile.saveError')); } }}><Bell />{t('notify.enableDevice')}</Button>}
    </div>}
    <span className="field-label">{t('notify.types')}</span>
    <div className="settings-list">{(['reminders', 'announcements', 'badges', 'followups'] as const).map(key => <label className="switch-row notify-row" key={key}>
      <span><strong>{t(`notify.type.${key}`)}</strong><small>{t(`notify.type.${key}Text`)}</small></span>
      <Switch checked={prefs[key]} onCheckedChange={v => void save({ [key]: v })} aria-label={t(`notify.type.${key}`)} /></label>)}</div>
  </div>;
}

// ---- Leader view on a gathering ----
export function OutboxSummary({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { data: rows = [] } = useQuery({
    queryKey: ['outbox-summary', eventId], refetchInterval: 60_000,
    queryFn: async () => (await supabase.from('notification_outbox').select('status, template').eq('event_id', eventId)).data ?? [],
  });
  const reminders = rows.filter(r => r.template === 'reminder_24h' || r.template === 'reminder_2h');
  const count = (list: typeof rows, s: string) => list.filter(r => r.status === s).length;
  const simulated = rows.some(r => r.status === 'simulated');
  return <section className="panel outbox-summary"><div className="section-heading"><h2>{t('notify.remindersTitle')}</h2>{simulated && <span className="chip not-connected-badge">{t('common.notConnected')}</span>}</div>
    <div className="recognition-summary">
      {([['pending', 'queued'], ['sent', 'sent'], ['simulated', 'simulated']] as const).map(([s, label]) => <div key={s}><strong>{count(reminders, s) + (s === 'pending' ? count(reminders, 'sending') : 0)}</strong><span>{t(`notify.status.${label}`)}</span></div>)}
    </div>
    <p className="auth-subtitle outbox-total">{t('notify.allMessages', { count: rows.length, skipped: count(rows, 'skipped') })}</p>
  </section>;
}
