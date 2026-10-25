import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { GuestShell } from '@/components/guest-shell';
import { Button } from '@/components/ui/button';
import type { CoachPreferenceRecord, CoachPreferences } from '@/lib/coach-updates';
import i18n from '@/lib/i18n';
export const Route = createFileRoute('/coach-updates/$token')({
 head: () => ({ meta: [{ title: `${i18n.t('coachUpdates.manage')} · ZoheeWell` }, { name: 'description', content: i18n.t('coachUpdates.consent') }, { property: 'og:title', content: i18n.t('coachUpdates.manage') }, { property: 'og:description', content: i18n.t('coachUpdates.consent') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }] }),
 component: Manage,
});
function Manage() {
 const { token } = Route.useParams(); const { t } = useTranslation();
 const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
 const [edited, setEdited] = useState<CoachPreferences | null>(null);
 const query = useQuery({ queryKey: ['coach-preferences', token], retry: false, queryFn: async () => {
  const { data, error } = await supabase.rpc('coach_update_preferences', { _token: token }); if (error) throw error; return data as CoachPreferenceRecord | null;
 } });
 const prefs = edited ?? { announcements: query.data?.announcements ?? false, events: query.data?.new_events ?? false, resources: query.data?.new_resources ?? false };
 const save = async (off = false) => {
  if (!query.data || busy) return; setBusy(true); setStatus('');
  try {
   const { error } = await supabase.rpc('save_coach_update_preferences', { _token: token, _announcements: !off && prefs.announcements, _events: !off && prefs.events, _resources: !off && prefs.resources });
   if (error) throw error; setStatus(off ? 'unsubscribed' : 'saved'); setEdited(null); await query.refetch();
  } catch { setStatus('error'); } finally { setBusy(false); }
 };
 return <GuestShell><section className="page-stack"><h1>{t('coachUpdates.manage')}</h1>
 {query.isPending ? <p role="status">{t('coachUpdates.loading')}</p> : query.isError ? <p role="alert">{t('coachUpdates.error')}</p> : !query.data ? <p role="status">{t('coachUpdates.invalid')}</p> : <>
 <h2>{query.data.coach}</h2><p>{t(query.data.confirmed ? 'coachUpdates.confirmedStatus' : 'coachUpdates.unconfirmedStatus')}</p>
 {(['announcements', 'events', 'resources'] as const).map(key => <label key={key} className="guest-consent"><input type="checkbox" checked={prefs[key]} onChange={event => setEdited({ ...prefs, [key]: event.target.checked })} /><span>{t(`coachUpdates.${key}`)}</span></label>)}
 <div className="chip-row"><Button disabled={busy || !Object.values(prefs).some(Boolean)} onClick={() => void save()}>{t(query.data.confirmed ? 'coachUpdates.savePreferences' : 'coachUpdates.confirm')}</Button><Button variant="secondary" disabled={busy} onClick={() => void save(true)}>{t('coachUpdates.unsubscribe')}</Button></div>
 {status && <p role="status">{t(`coachUpdates.${status}`)}</p>}</>}
 </section></GuestShell>;
}
