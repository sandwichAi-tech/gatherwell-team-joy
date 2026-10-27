import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { pick } from '@/lib/learn';
import { RetryState } from '@/components/launch-states';
export function CourseResourceAttachments({ courseId }: { courseId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['course-resource-attachments', courseId], queryFn: async () => {
    const { data, error } = await supabase.rpc('resource_course_attachments', { _course: courseId }); if (error) throw error;
    return (data ?? []) as unknown as { id: string; kind: string; title_en: string; title_es: string }[];
  } });
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!q.data?.length) return null;
  return <section className="learn-section"><h2>{t('resources.title')}</h2><p className="field-hint">{t('resourcePlacement.courseAccess')}</p><ul className="lesson-list">{q.data.map(r => <li key={r.id}><strong>{pick(i18n.resolvedLanguage ?? 'en', r.title_en, r.title_es)}</strong><Button asChild variant="secondary"><Link to="/resource/$kind/$id" params={{ kind: r.kind, id: r.id }}>{t('resources.open')}</Link></Button></li>)}</ul></section>;
}