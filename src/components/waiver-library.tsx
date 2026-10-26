import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { WaiverEditorSheet } from '@/components/waiver';

export type LibraryWaiver = {id:string;name:string;body_en:string;body_es:string;version:number;archived:boolean};
export function useWaiverLibrary(teamId: string) {
  return useQuery({queryKey:['waiver-library',teamId],enabled:!!teamId,queryFn:async()=>{
    const {data,error}=await supabase.from('waiver_library').select('id,name,body_en,body_es,version,archived').eq('team_id',teamId).order('updated_at',{ascending:false});
    if(error) throw error; return data;
  }});
}
export function WaiverLibrary({teamId}:{teamId:string}) {
  const {t,i18n}=useTranslation();const qc=useQueryClient();const q=useWaiverLibrary(teamId);
  const [edit,setEdit]=useState<LibraryWaiver|null>(null);const [preview,setPreview]=useState<LibraryWaiver|null>(null);const [teamEdit,setTeamEdit]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const save=async(archived=false)=>{
    if(!edit)return;setBusy(true);setError('');
    try {const r=await supabase.rpc('save_library_waiver',{_team:teamId,_id:edit.id||null,_name:edit.name,_en:edit.body_en,_es:edit.body_es,_archive:archived} as never);if(r.error)throw r.error;setEdit(null);await qc.invalidateQueries({queryKey:['waiver-library',teamId]});}
    catch{setError(t('waiverLibrary.saveError'));}finally{setBusy(false);}
  };
  useEffect(()=>{if(edit){const id=requestAnimationFrame(()=>document.getElementById('wl-name')?.focus());return()=>cancelAnimationFrame(id);}},[!!edit]);
  return <section className="form-section">
    <p className="field-hint">{t('waiverLibrary.scope')}</p>
    <Button variant="secondary" onClick={()=>setTeamEdit(true)}>{t('waiverLibrary.team')}</Button>
    <p className="field-hint">{t('waiverLibrary.textOnly')}</p>
    {q.isPending?<p aria-busy="true">{t('publicEvent.loading')}</p>:q.error?<div role="alert">{t('eventWaivers.errors.load')}<Button onClick={()=>void q.refetch()}>{t('error.retry')}</Button></div>:!q.data?.length?<p>{t('waiverLibrary.empty')}</p>:<ul className="plain-list">{q.data.map(w=><li key={w.id} className="form-section"><strong>{w.name}</strong><p>{t('waiver.version',{n:w.version})}{w.archived?` · ${t('eventWaivers.archived')}`:''}</p><div className="chip-row"><Button variant="secondary" onClick={()=>setPreview(w)}>{t('eventWaivers.preview')}</Button>{!w.archived&&<Button variant="secondary" onClick={()=>{setError('');setEdit(w);}}>{t('eventWaivers.edit')}</Button>}</div></li>)}</ul>}
    <Button onClick={()=>{setError('');setEdit({id:'',name:'',body_en:'',body_es:'',version:0,archived:false});}}>{t('eventWaivers.add')}</Button>
    <WaiverEditorSheet teamId={teamId} open={teamEdit} onClose={()=>setTeamEdit(false)}/>
    {preview&&<ResponsiveSheet open title={preview.name} onOpenChange={o=>!o&&setPreview(null)}><p>{t('waiver.version',{n:preview.version})}</p><div className="waiver-text whitespace-pre-wrap" role="document" tabIndex={0}>{i18n.resolvedLanguage==='es'?preview.body_es||preview.body_en:preview.body_en}</div></ResponsiveSheet>}
    {edit&&<ResponsiveSheet open title={t('waiverLibrary.title')} onOpenChange={o=>!o&&setEdit(null)} footer={<Button disabled={busy||!edit.name.trim()||!edit.body_en.trim()} onClick={()=>void save()}>{busy?t('onboarding.saving'):t('waiver.save')}</Button>}>
      <div className="edit-form"><p>{t('waiverLibrary.versionHelp')}</p><label htmlFor="wl-name">{t('eventWaivers.titleLabel')}</label><Input id="wl-name" maxLength={120} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/><label htmlFor="wl-en">{t('waiver.bodyEn')}</label><Textarea id="wl-en" rows={8} maxLength={12000} value={edit.body_en} onChange={e=>setEdit({...edit,body_en:e.target.value})}/><label htmlFor="wl-es">{t('waiver.bodyEs')}</label><Textarea id="wl-es" rows={8} maxLength={12000} value={edit.body_es} onChange={e=>setEdit({...edit,body_es:e.target.value})}/>{error&&<p role="alert">{error}</p>}{edit.id&&<Button variant="secondary" disabled={busy} onClick={()=>void save(true)}>{t('eventWaivers.archive')}</Button>}</div>
    </ResponsiveSheet>}
  </section>;
}

/** Explicit version selection; the event stores an independent immutable content snapshot. */
export function WaiverLibraryPicker({teamId,value,onChange}:{teamId:string;value:{id:string;version:number}[];onChange:(v:{id:string;version:number}[])=>void}) {
  const {t,i18n}=useTranslation();const q=useWaiverLibrary(teamId);
  return <section className="form-section"><h2>{t('waiverLibrary.select')}</h2><p className="field-hint">{t('waiverLibrary.scope')}</p>
    {q.isPending?<p aria-busy="true">{t('publicEvent.loading')}</p>:q.error?<p role="alert">{t('eventWaivers.errors.load')}<Button variant="secondary" onClick={()=>void q.refetch()}>{t('error.retry')}</Button></p>:!q.data?.some(w=>!w.archived)?<p>{t('waiverLibrary.empty')}</p>:<><label htmlFor="wl-select">{t('waiverLibrary.select')}</label><select id="wl-select" className="field-input w-full" value="" onChange={e=>{const w=q.data?.find(w=>w.id===e.target.value);if(w&&!value.some(x=>x.id===w.id))onChange([...value,{id:w.id,version:w.version}]);}}><option value="">{t('waiverLibrary.choose')}</option>{q.data?.filter(w=>!w.archived&&!value.some(v=>v.id===w.id)).map(w=><option key={w.id} value={w.id}>{w.name} · {t('waiver.version',{n:w.version})}</option>)}</select></>}
    {value.map(v=>{const w=q.data?.find(w=>w.id===v.id);return <div key={v.id}><strong>{w?.name??t('waiverLibrary.title')} · {t('waiver.version',{n:v.version})}</strong><p className="field-hint">{t('waiverLibrary.pinned')}</p>{w?.version===v.version&&<details><summary>{t('eventWaivers.preview')}</summary><p className="whitespace-pre-wrap">{i18n.resolvedLanguage==='es'?w.body_es||w.body_en:w.body_en}</p></details>}<Button variant="ghost" onClick={()=>onChange(value.filter(x=>x.id!==v.id))}>{t('common.remove',{defaultValue:t('eventWaivers.archive')})}</Button></div>;})}
  </section>;
}