import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { GuestShell } from '@/components/guest-shell';
import { Button } from '@/components/ui/button';
import i18n from '@/lib/i18n';
export const Route=createFileRoute('/coach-updates/$token')({head:()=>({meta:[{title:`${i18n.t('coachUpdates.manage')} · ZoheeWell`},{name:'description',content:i18n.t('coachUpdates.consent')},{property:'og:title',content:i18n.t('coachUpdates.manage')},{property:'og:description',content:i18n.t('coachUpdates.consent')},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),component:Manage});
 function Manage(){const {token}=Route.useParams();const {t}=useTranslation();const [saved,setSaved]=useState(false);const [editedPrefs,setPrefs]=useState<{announcements:boolean;events:boolean;resources:boolean}|null>(null);
 const q=useQuery({queryKey:['coach-preferences',token],queryFn:async()=>{const {data,error}=await supabase.rpc('coach_update_preferences',{_token:token});if(error)throw error;return data as {coach:string;announcements:boolean;new_events:boolean;new_resources:boolean}|null;}});
 const prefs=editedPrefs??{announcements:q.data?.announcements??false,events:q.data?.new_events??false,resources:q.data?.new_resources??false};
 const save=async(off=false)=>{const {error}=await supabase.rpc('save_coach_update_preferences',{_token:token,_announcements:!off&&prefs.announcements,_events:!off&&prefs.events,_resources:!off&&prefs.resources});setSaved(!error);};
 return <GuestShell><section className="page-stack"><h1>{t('coachUpdates.manage')}</h1>{q.isPending?<p>{t('coachUpdates.loading')}</p>:!q.data?<p>{t('coachUpdates.invalid')}</p>:<><h2>{q.data.coach}</h2>{(['announcements','events','resources'] as const).map(k=><label key={k} className="guest-consent"><input type="checkbox" checked={prefs[k]} onChange={e=>setPrefs({...prefs,[k]:e.target.checked})}/>{t(`coachUpdates.${k}`)}</label>)}<Button onClick={()=>void save()}>{t('coachUpdates.confirm')}</Button><Button variant="secondary" onClick={()=>void save(true)}>{t('coachUpdates.unsubscribe')}</Button>{saved&&<p role="status">{t('coachUpdates.saved')}</p>}</>}</section></GuestShell>;
}