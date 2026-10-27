import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { safeExternalUrl } from '@/lib/wellness-assessment';
import { pick } from '@/lib/learn';
export function CourseOutlinePreview({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['course-outline-preview', id], queryFn: async () => {
    const { data: tracks, error } = await supabase.from('tracks').select('id,title_en,title_es,is_published').eq('offer_id', id).order('sort_order').order('created_at'); if (error) throw error;
    const ids = (tracks ?? []).map(tr => tr.id);
    const { data: lessons, error: e } = ids.length ? await supabase.from('lessons').select('id,track_id,title_en,title_es,type,url,is_published').in('track_id', ids).is('detached_at', null).order('sort_order').order('created_at').order('id') : { data: [], error: null }; if (e) throw e;
    return { tracks: tracks ?? [], lessons: lessons ?? [] };
  } });
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  return <div className="edit-form"><h2>{t('content.curriculum')}</h2>{q.data.tracks.map(tr => <section key={tr.id}><h3>{pick(i18n.resolvedLanguage, tr.title_en, tr.title_es)}{!tr.is_published && ` · ${t('templates.draft')}`}</h3><ol>{q.data.lessons.filter(l => l.track_id === tr.id).map(l => <li key={l.id}>{l.type === 'link' && l.url && safeExternalUrl(l.url) ? <a href={l.url} target="_blank" rel="noopener noreferrer">{pick(i18n.resolvedLanguage, l.title_en, l.title_es)} ↗</a> : pick(i18n.resolvedLanguage, l.title_en, l.title_es)}{!l.is_published && ` · ${t('templates.draft')}`}</li>)}</ol></section>)}</div>;
}