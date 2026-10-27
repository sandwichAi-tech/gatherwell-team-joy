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
import { uploadHostWaiver, signHostWaiver, cleanupHostWaiverUpload } from '@/lib/host-waivers.functions';
import { Upload, FileText } from '@/components/icons';

export type LibraryWaiver = {id:string;name:string;body_en:string;body_es:string;version:number;archived:boolean;file_path:string|null;file_name:string|null;is_default:boolean;updated_at?:string};
export const emptyWaiver = (): LibraryWaiver => ({id:'',name:'',body_en:'',body_es:'',version:0,archived:false,file_path:null,file_name:null,is_default:false});
/** Owner-scoped: RLS only returns waivers owned by the signed-in host. */
export function useWaiverLibrary(userId: string) {
  return useQuery({queryKey:['waiver-library',userId],enabled:!!userId,queryFn:async()=>{
    const {data,error}=await supabase.from('waiver_library').select('id,name,body_en,body_es,version,archived,file_path,file_name,is_default,updated_at').order('updated_at',{ascending:false});
    if(error) throw error; return data as LibraryWaiver[];
  }});
}

export function HostWaiverEditor({teamId,initial,onClose,onSaved}:{teamId:string;initial:LibraryWaiver;onClose:()=>void;onSaved?:(id:string)=>void}) {
  const {t,i18n}=useTranslation();const qc=useQueryClient();const es=i18n.resolvedLanguage==='es';
  const [edit,setEdit]=useState(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const upload=useServerFn(uploadHostWaiver);const cleanup=useServerFn(cleanupHostWaiverUpload);const [uploads,setUploads]=useState<string[]>([]);
  const clearUploads=async(keep?:string|null)=>{for(const path of uploads)if(path!==keep)await cleanup({data:{path}}).catch(()=>null);setUploads([]);};
  const close=async()=>{if(busy)return;await clearUploads();onClose();};
  useEffect(()=>{const id=requestAnimationFrame(()=>document.getElementById('wl-name')?.focus());return()=>cancelAnimationFrame(id);},[]);
  const valid=!!edit.name.trim()&&(!!edit.body_en.trim()||!!edit.file_path);
  const save=async(archived=false)=>{
    if(busy)return;if(!valid){setError(t('waiverLibrary.saveError'));return;}setBusy(true);setError('');
    try{const r=await supabase.rpc('save_host_waiver',{_team:teamId,_id:edit.id||null,_name:edit.name,_en:edit.body_en,_es:edit.body_es,_file:edit.file_path,_filename:edit.file_name,_archive:archived} as never);if(r.error||!r.data)throw r.error;await clearUploads(edit.file_path);await qc.invalidateQueries({queryKey:['waiver-library']});onSaved?.(r.data as string);onClose();}
    catch{setError(t('waiverLibrary.saveError'));}finally{setBusy(false);}
  };
  const file=async(f:File)=>{if(busy)return;if(!safeWaiverPdf(f.size,f.type,await f.slice(0,5).text())){setError(t('eventWaivers.errors.fileType'));return;}setBusy(true);setError('');try{const form=new FormData();form.set('file',f);const r=await upload({data:form});setUploads(x=>[...x,r.path]);setEdit(e=>({...e,file_path:r.path,file_name:f.name.slice(0,120)}));}catch{setError(t('eventWaivers.errors.upload'));}finally{setBusy(false);}};
  return <ResponsiveSheet open title={edit.id?t('builderAgreements.editWaiver'):t('builderAgreements.newWaiver')} onOpenChange={o=>!o&&void close()} footer={<Button disabled={busy||!valid} onClick={()=>void save()}>{busy?t('onboarding.saving'):t('waiver.save')}</Button>}>
    <div className="edit-form"><p>{t('waiverLibrary.versionHelp')}</p><p className="field-hint">{t('waiverLibrary.textOnly')}</p>
      <label htmlFor="wl-name">{t('eventWaivers.titleLabel')}</label><Input id="wl-name" maxLength={120} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/>
      <label htmlFor="wl-body">{t('eventWaivers.bodyLabel')} · {t(es?'me.spanish':'me.english')}</label><Textarea id="wl-body" rows={8} maxLength={12000} value={es?edit.body_es:edit.body_en} onChange={e=>setEdit({...edit,[es?'body_es':'body_en']:e.target.value})}/>
      {es&&!edit.body_en.trim()&&!edit.file_path&&<p className="field-hint">{t('builderAgreements.englishNeeded')}</p>}
      <label className="button-like secondary"><Upload/>{busy?t('onboarding.saving'):t('eventWaivers.uploadPdf')}<input type="file" accept="application/pdf" disabled={busy} className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(f)void file(f);e.target.value='';}}/></label>
      {edit.file_name&&<p>{edit.file_name}</p>}{error&&<p role="alert" className="field-error">{error}</p>}
      {edit.id&&<Button variant="secondary" disabled={busy} onClick={()=>void save(true)}>{t('eventWaivers.archive')}</Button>}
    </div>
  </ResponsiveSheet>;
}

export function HostWaiverPreview({waiver,onClose}:{waiver:{id:string;name:string;version:number;body_en:string;body_es:string;file_path:string|null;file_name:string|null};onClose:()=>void}) {
  const {t,i18n}=useTranslation();const es=i18n.resolvedLanguage==='es';const sign=useServerFn(signHostWaiver);const [error,setError]=useState('');
  return <ResponsiveSheet open title={waiver.name} onOpenChange={o=>!o&&onClose()}><p>{t('waiver.version',{n:waiver.version})}</p>
    {(es?waiver.body_es||waiver.body_en:waiver.body_en)?<div className="waiver-text whitespace-pre-wrap" role="document" tabIndex={0}>{es?waiver.body_es||waiver.body_en:waiver.body_en}</div>:null}
    {waiver.file_path&&<Button variant="secondary" onClick={async()=>{try{const r=await sign({data:{id:waiver.id,version:waiver.version}});if(r.url)window.open(r.url,'_blank','noopener');else setError(t('eventWaivers.errors.file'));}catch{setError(t('eventWaivers.errors.file'));}}}><FileText/>{t('eventWaivers.openFile',{name:waiver.file_name})}</Button>}
    {error&&<p role="alert">{error}</p>}
  </ResponsiveSheet>;
}

export function WaiverLibrary({teamId,userId}:{teamId:string;userId:string}) {
  const {t}=useTranslation();const qc=useQueryClient();const q=useWaiverLibrary(userId);
  const [edit,setEdit]=useState<LibraryWaiver|null>(null);const [preview,setPreview]=useState<LibraryWaiver|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <section className="form-section">
    <p className="field-hint">{t('waiverLibrary.scope')}</p><p className="field-hint">{t('waiverLibrary.textOnly')}</p>
    {q.isPending?<p aria-busy="true">{t('publicEvent.loading')}</p>:q.error?<div role="alert">{t('eventWaivers.errors.load')}<Button onClick={()=>void q.refetch()}>{t('error.retry')}</Button></div>:!q.data?.length?<p>{t('waiverLibrary.empty')}</p>:<ul className="plain-list">{q.data.map(w=><li key={w.id} className="form-section"><strong>{w.name}</strong><p>{t('waiver.version',{n:w.version})}{w.archived?` · ${t('eventWaivers.archived')}`:''}{w.is_default?` · ${t('waiverLibrary.default')}`:''}</p><div className="chip-row"><Button variant="secondary" onClick={()=>setPreview(w)}>{t('eventWaivers.preview')}</Button>{!w.archived&&<><Button variant="secondary" onClick={()=>{setError('');setEdit(w);}}>{t('eventWaivers.edit')}</Button><Button variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);const r=await supabase.rpc('set_host_waiver_default',{_id:w.id,_on:!w.is_default});if(r.error)setError(t('waiverLibrary.saveError'));await qc.invalidateQueries({queryKey:['waiver-library']});setBusy(false);}}>{t(w.is_default?'waiverLibrary.clearDefault':'waiverLibrary.makeDefault')}</Button></>}</div></li>)}</ul>}
    <Button onClick={()=>{setError('');setEdit(emptyWaiver());}}>{t('eventWaivers.add')}</Button>
    {error&&<p role="alert">{error}</p>}
    {preview&&<HostWaiverPreview waiver={preview} onClose={()=>setPreview(null)}/>}
    {edit&&<HostWaiverEditor teamId={teamId} initial={edit} onClose={()=>setEdit(null)}/>}
  </section>;
}
