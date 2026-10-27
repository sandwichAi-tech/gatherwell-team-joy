import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { safeWaiverPdf } from '@/lib/event-agreements';
import { useServerFn } from '@tanstack/react-start';
import { uploadHostWaiver, signHostWaiver } from '@/lib/host-waivers.functions';
import { Upload, FileText } from '@/components/icons';

export type LibraryWaiver = {id:string;name:string;body_en:string;body_es:string;version:number;archived:boolean;file_path:string|null;file_name:string|null;is_default:boolean};
export function useWaiverLibrary(teamId: string) {
  return useQuery({queryKey:['waiver-library',teamId],enabled:!!teamId,queryFn:async()=>{
    const {data,error}=await supabase.from('waiver_library').select('id,name,body_en,body_es,version,archived,file_path,file_name,is_default').order('updated_at',{ascending:false});
    if(error) throw error; return data;
  }});
}
export function WaiverLibrary({teamId}:{teamId:string}) {
  const {t,i18n}=useTranslation();const qc=useQueryClient();const q=useWaiverLibrary(teamId);const es=i18n.resolvedLanguage==='es';
  const [edit,setEdit]=useState<LibraryWaiver|null>(null);const [preview,setPreview]=useState<LibraryWaiver|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const upload=useServerFn(uploadHostWaiver);const sign=useServerFn(signHostWaiver);
  const refresh=()=>qc.invalidateQueries({queryKey:['waiver-library']});
  const save=async(archived=false)=>{
    if(!edit||busy)return;if(!edit.name.trim()||(!edit.body_en.trim()&&!edit.file_path)){setError(t('waiverLibrary.saveError'));return;}setBusy(true);setError('');
    try {const r=await supabase.rpc('save_host_waiver',{_team:teamId,_id:edit.id||null,_name:edit.name,_en:edit.body_en,_es:edit.body_es,_file:edit.file_path,_filename:edit.file_name,_archive:archived} as never);if(r.error)throw r.error;setEdit(null);await refresh();}
    catch{setError(t('waiverLibrary.saveError'));}finally{setBusy(false);}
  };
  useEffect(()=>{if(!edit)return;const id=requestAnimationFrame(()=>document.getElementById('wl-name')?.focus());return()=>cancelAnimationFrame(id);},[!!edit]);
  const file=async(f:File)=>{if(!edit||busy)return;if(!safeWaiverPdf(f.size,f.type,await f.slice(0,5).text())){setError(t('eventWaivers.errors.fileType'));return;}setBusy(true);try{const form=new FormData();form.set('file',f);const r=await upload({data:form});setEdit({...edit,file_path:r.path,file_name:f.name.slice(0,120)});}catch{setError(t('eventWaivers.errors.upload'));}finally{setBusy(false);}};
  return <section className="form-section">
    <p className="field-hint">{t('waiverLibrary.scope')}</p><p className="field-hint">{t('waiverLibrary.textOnly')}</p>
    {q.isPending?<p aria-busy="true">{t('publicEvent.loading')}</p>:q.error?<div role="alert">{t('eventWaivers.errors.load')}<Button onClick={()=>void q.refetch()}>{t('error.retry')}</Button></div>:!q.data?.length?<p>{t('waiverLibrary.empty')}</p>:<ul className="plain-list">{q.data.map(w=><li key={w.id} className="form-section"><strong>{w.name}</strong><p>{t('waiver.version',{n:w.version})}{w.archived?` · ${t('eventWaivers.archived')}`:''}{w.is_default?` · ${t('waiverLibrary.default')}`:''}</p><div className="chip-row"><Button variant="secondary" onClick={()=>setPreview(w)}>{t('eventWaivers.preview')}</Button>{!w.archived&&<><Button variant="secondary" onClick={()=>{setError('');setEdit(w);}}>{t('eventWaivers.edit')}</Button><Button variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);const r=await supabase.rpc('set_host_waiver_default',{_id:w.id,_on:!w.is_default});if(r.error)setError(t('waiverLibrary.saveError'));await refresh();setBusy(false);}}>{t(w.is_default?'waiverLibrary.clearDefault':'waiverLibrary.makeDefault')}</Button></>}</div></li>)}</ul>}
    <Button onClick={()=>{setError('');setEdit({id:'',name:'',body_en:'',body_es:'',version:0,archived:false,file_path:null,file_name:null,is_default:false});}}>{t('eventWaivers.add')}</Button>
    {error&&!edit&&<p role="alert">{error}</p>}
    {preview&&<ResponsiveSheet open title={preview.name} onOpenChange={o=>!o&&setPreview(null)}><p>{t('waiver.version',{n:preview.version})}</p><div className="waiver-text whitespace-pre-wrap" role="document" tabIndex={0}>{es?preview.body_es||preview.body_en:preview.body_en}</div>{preview.file_path&&<Button variant="secondary" onClick={async()=>{const r=await sign({data:{id:preview.id,version:preview.version}});if(r.url)window.open(r.url,'_blank','noopener');else setError(t('eventWaivers.errors.file'));}}><FileText/>{t('eventWaivers.openFile',{name:preview.file_name})}</Button>}</ResponsiveSheet>}
    {edit&&<ResponsiveSheet open title={t('waiverLibrary.title')} onOpenChange={o=>!o&&!busy&&setEdit(null)} footer={<Button disabled={busy||!edit.name.trim()||(!edit.body_en.trim()&&!edit.file_path)} onClick={()=>void save()}>{busy?t('onboarding.saving'):t('waiver.save')}</Button>}>
      <div className="edit-form"><p>{t('waiverLibrary.versionHelp')}</p><label htmlFor="wl-name">{t('eventWaivers.titleLabel')}</label><Input id="wl-name" maxLength={120} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/><label htmlFor="wl-body">{t('eventWaivers.bodyLabel')}</label><Textarea id="wl-body" rows={8} maxLength={12000} value={es?edit.body_es:edit.body_en} onChange={e=>setEdit({...edit,[es?'body_es':'body_en']:e.target.value})}/><label className="button-like secondary"><Upload/>{busy?t('onboarding.saving'):t('eventWaivers.uploadPdf')}<input type="file" accept="application/pdf" disabled={busy} className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(f)void file(f);e.target.value='';}}/></label>{edit.file_name&&<p>{edit.file_name}</p>}{error&&<p role="alert">{error}</p>}{edit.id&&<Button variant="secondary" disabled={busy} onClick={()=>void save(true)}>{t('eventWaivers.archive')}</Button>}</div>
    </ResponsiveSheet>}
  </section>;
}
export function WaiverLibraryPicker({teamId,value,onChange}:{teamId:string;value:{id:string;version:number}[];onChange:(v:{id:string;version:number}[])=>void}) {
  const {t,i18n}=useTranslation();const q=useWaiverLibrary(teamId);const def=q.data?.find(w=>w.is_default&&!w.archived);
  return <section className="form-section"><h2>{t('waiverLibrary.select')}</h2><p className="field-hint">{t('waiverLibrary.scope')}</p>
    {def&&!value.some(x=>x.id===def.id)&&<Button type="button" variant="secondary" onClick={()=>onChange([...value,{id:def.id,version:def.version}])}>{t('waiverLibrary.applyDefault',{name:def.name})}</Button>}
    {q.isPending?<p aria-busy="true">{t('publicEvent.loading')}</p>:q.error?<p role="alert">{t('eventWaivers.errors.load')}<Button type="button" variant="secondary" onClick={()=>void q.refetch()}>{t('error.retry')}</Button></p>:!q.data?.some(w=>!w.archived)?<p>{t('waiverLibrary.empty')}</p>:<><label htmlFor="wl-select">{t('waiverLibrary.select')}</label><select id="wl-select" className="field-input w-full" value="" onChange={e=>{const w=q.data?.find(w=>w.id===e.target.value);if(w&&!value.some(x=>x.id===w.id))onChange([...value,{id:w.id,version:w.version}]);}}><option value="">{t('waiverLibrary.choose')}</option>{q.data?.filter(w=>!w.archived&&!value.some(v=>v.id===w.id)).map(w=><option key={w.id} value={w.id}>{w.name} · {t('waiver.version',{n:w.version})}</option>)}</select></>}
    {value.map(v=>{const w=q.data?.find(w=>w.id===v.id);return <div key={v.id}><strong>{w?.name??t('waiverLibrary.title')} · {t('waiver.version',{n:v.version})}</strong><p className="field-hint">{t('waiverLibrary.pinned')}</p>{w?.version===v.version&&<details><summary>{t('eventWaivers.preview')}</summary><p className="whitespace-pre-wrap">{i18n.resolvedLanguage==='es'?w.body_es||w.body_en:w.body_en}</p></details>}<Button type="button" variant="ghost" onClick={()=>onChange(value.filter(x=>x.id!==v.id))}>{t('eventWaivers.archive')}</Button></div>;})}
  </section>;
}
