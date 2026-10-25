import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ResponsiveSheet } from './responsive-sheet';
import { coachUpdatesSetup,requestCoachUpdates,subscriberSegments } from '@/lib/coach-updates.functions';
export function GetCoachUpdates({slug}:{slug:string}) {
 const {t,i18n}=useTranslation();const [open,setOpen]=useState(false);const [email,setEmail]=useState('');const [adult,setAdult]=useState(false);const [prefs,setPrefs]=useState({announcements:false,events:false,resources:false});const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 const setup=useQuery({queryKey:['coach-updates-setup'],queryFn:()=>coachUpdatesSetup()});const submit=useServerFn(requestCoachUpdates);
 const ready=setup.data?.confirmation&&setup.data.delivery;
 return <><Button variant="secondary" onClick={()=>setOpen(true)}>{t('coachUpdates.title')}</Button><ResponsiveSheet open={open} onOpenChange={setOpen} title={t('coachUpdates.title')} footer={<Button disabled={!ready||!adult||busy||!email.includes('@')||!Object.values(prefs).some(Boolean)} onClick={async()=>{setBusy(true);try{const r=await submit({data:{slug,email,language:i18n.resolvedLanguage==='es'?'es':'en',adult:true,origin:window.location.origin,...prefs}});setStatus(r.ok?'pending':'setup');}catch{setStatus('error');}finally{setBusy(false);}}}>{t('coachUpdates.request')}</Button>}>
 {!ready&&<p role="status">{t('coachUpdates.setup')}</p>}<label className="field-label">{t('coachUpdates.email')}<Input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {(['announcements','events','resources'] as const).map(k=><label className="guest-consent" key={k}><input type="checkbox" checked={prefs[k]} onChange={e=>setPrefs(p=>({...p,[k]:e.target.checked}))}/><span>{t(`coachUpdates.${k}`)}</span></label>)}<label className="guest-consent"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/>{t('coachUpdates.adult')}</label><p>{t('coachUpdates.consent')}</p>{status&&<p role="status">{t(`coachUpdates.${status}`)}</p>}
 </ResponsiveSheet></>;
}
export function CoachSubscriberSegments(){const {t}=useTranslation();const read=useServerFn(subscriberSegments);const q=useQuery({queryKey:['coach-subscriber-segments'],queryFn:()=>read()});return <section className="comms-section"><h2>{t('coachUpdates.segments')}</h2>{q.data?<div className="stats-grid">{(['confirmed','announcements','new_events','new_resources'] as const).map(k=><div className="stat-card" key={k}><strong>{q.data?.[k]??0}</strong><p>{t(`coachUpdates.segment_${k}`)}</p></div>)}</div>:<p>{t('coachUpdates.loading')}</p>}<p>{t('coachUpdates.setup')}</p></section>;}