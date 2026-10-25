import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ResponsiveSheet } from './responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { useGatherwell } from './gatherwell-shell';
import { coachUpdatesSetup, requestCoachUpdates, subscriberSegments } from '@/lib/coach-updates.functions';
import type { CoachPreferenceRecord, CoachPreferences } from '@/lib/coach-updates';

export function GetCoachUpdates({ slug }: { slug: string }) {
 const { t, i18n } = useTranslation();
 const [open, setOpen] = useState(false);
 const [email, setEmail] = useState('');
 const [adult, setAdult] = useState(false);
 const [edited, setEdited] = useState<CoachPreferences | null>(null);
 const [status, setStatus] = useState('');
 const [busy, setBusy] = useState(false);
 const viewer = useQuery({ queryKey: ['coach-update-viewer'], queryFn: async () => (await supabase.auth.getUser()).data.user ?? null });
 const verified = !!viewer.data?.email_confirmed_at;
 const mine = useQuery({ queryKey: ['my-coach-updates', slug, viewer.data?.id], enabled: open && verified, queryFn: async () => {
  const { data, error } = await supabase.rpc('my_coach_updates', { _slug: slug });
  if (error) throw error; return data as CoachPreferenceRecord | null;
 } });
 const prefs = edited ?? { announcements: mine.data?.announcements ?? false, events: mine.data?.new_events ?? false, resources: mine.data?.new_resources ?? false };
 const setup = useQuery({ queryKey: ['coach-updates-setup'], queryFn: () => coachUpdatesSetup() });
 const submit = useServerFn(requestCoachUpdates);
 const save = async (off = false) => {
  setBusy(true); setStatus('');
  try {
   if (verified) {
    const { error } = await supabase.rpc('save_my_coach_updates', { _slug: slug, _announcements: !off && prefs.announcements, _events: !off && prefs.events, _resources: !off && prefs.resources, _adult: adult });
    if (error) throw error; setStatus(off ? 'unsubscribed' : 'saved'); setEdited(null); await mine.refetch();
   } else {
    const result = await submit({ data: { slug, email, language: i18n.resolvedLanguage === 'es' ? 'es' : 'en', adult: true, origin: window.location.origin, ...prefs } });
    setStatus(result.reason === 'confirmation_pending' ? 'pending' : 'pendingNoSender');
   }
  } catch { setStatus('error'); } finally { setBusy(false); }
 };
 const disabled = busy || !adult || (!verified && !email.includes('@')) || !Object.values(prefs).some(Boolean);
 return <><Button variant="secondary" onClick={() => setOpen(true)}>{t('coachUpdates.title')}</Button>
 {open && <ResponsiveSheet open onOpenChange={setOpen} title={t('coachUpdates.title')} footer={<Button type="submit" form="coach-updates-form" disabled={disabled}>{busy ? t('onboarding.saving') : t(verified ? 'coachUpdates.savePreferences' : 'coachUpdates.request')}</Button>}>
 <form id="coach-updates-form" onSubmit={event => { event.preventDefault(); if (!disabled) void save(); }}>
 {!setup.data?.delivery && <p role="status">{t('coachUpdates.setup')}</p>}
 {!verified && <label className="field-label" htmlFor="coach-update-email">{t('coachUpdates.email')}<Input id="coach-update-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
 {(['announcements', 'events', 'resources'] as const).map(key => <label className="guest-consent" key={key}><input type="checkbox" checked={prefs[key]} onChange={event => setEdited({ ...prefs, [key]: event.target.checked })} /><span>{t(`coachUpdates.${key}`)}</span></label>)}
 <label className="guest-consent"><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} /><span>{t('coachUpdates.adult')}</span></label>
 <p>{t('coachUpdates.consent')}</p>
 {!verified && <Button asChild variant="ghost"><Link to="/login" search={{ next: `/h/${slug}` }}>{t('coachUpdates.accountConfirm')}</Link></Button>}
 {verified && mine.data?.confirmed && <Button variant="secondary" disabled={busy || !adult} onClick={() => void save(true)}>{t('coachUpdates.unsubscribe')}</Button>}
 {status && <p role="status">{t(`coachUpdates.${status}`)}</p>}
 </form></ResponsiveSheet>}</>;
}

export function CoachSubscriberSegments() {
 const { t } = useTranslation(); const { userId } = useGatherwell(); const read = useServerFn(subscriberSegments);
 const query = useQuery({ queryKey: ['coach-subscriber-segments', userId], queryFn: () => read(), enabled: !!userId });
 return <section className="comms-section"><h2>{t('coachUpdates.segments')}</h2>
 {query.isError ? <p role="alert">{t('coachUpdates.error')}</p> : query.data ? <div className="stats-grid">{(['confirmed', 'announcements', 'new_events', 'new_resources'] as const).map(key => <div className="stat-card" key={key}><strong>{query.data[key]}</strong><p>{t(`coachUpdates.segment_${key}`)}</p></div>)}</div> : <p>{t('coachUpdates.loading')}</p>}
 <p className="field-hint">{t('coachUpdates.setup')}</p></section>;
}
