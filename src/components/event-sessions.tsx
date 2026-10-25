import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import type { EventSession } from '@/lib/event-sessions';
export function EventSessions({ eventId, token }: { eventId: string; token?: string | undefined }) {
 const { t, i18n } = useTranslation();
 const q = useQuery({ queryKey: ['event-sessions',eventId,token], queryFn: async () => {
  const {data,error}=await supabase.rpc('public_event_sessions',{_event:eventId,...(token ? {_token:token}: {})}); if(error)throw error; return data as unknown as EventSession[];
 } });
 if(!q.data?.length)return null;
 return <section className="form-section"><h2>{t('sessions.heading')}</h2><p>{t('sessions.scope')}</p><ol>{q.data.map((s,i)=><li key={i} className="event-row"><div><h3>{s.title}</h3><p>{new Date(s.starts_at).toLocaleString(i18n.resolvedLanguage)} – {new Date(s.ends_at).toLocaleString(i18n.resolvedLanguage)}</p>{s.place&&<p>{s.place}</p>}</div></li>)}</ol></section>;
}