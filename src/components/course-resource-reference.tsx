import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { RetryState } from '@/components/launch-states';
import { pick } from '@/lib/learn';
import { useLearn } from '@/components/learn';
type Resource = { id: string; kind: 'quiz' | 'offer' | 'recipe'; title_en: string; title_es: string };
export function CourseResourcePicker({ course, track }: { course: string; track: string }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['course-reuse', course], enabled: open, queryFn: async () => { const r = await supabase.rpc('course_reusable_resources', { _course: course }); if (r.error) throw r.error; return r.data as unknown as Resource[]; } });
  const attach = async (r: Resource) => { if (busy) return; setBusy(true); try { const result = await supabase.rpc('attach_course_resource', { _track: track, _kind: r.kind, _resource: r.id }); if (result.error) throw result.error; await qc.invalidateQueries({ queryKey: ['curriculum', course] }); setOpen(false); } catch { toast.error(t('profile.saveError')); } finally { setBusy(false); } };
  return <><Button variant="secondary" onClick={() => setOpen(true)}>{t('lifecycle.useExisting')}</Button>{open && <ResponsiveSheet open onOpenChange={setOpen} title={t('lifecycle.useExisting')}><p>{t('lifecycle.reuseHint')}</p>{q.isError ? <RetryState retry={() => void q.refetch()} /> : q.isPending ? <p role="status">{t('publicEvent.loading')}</p> : <ul className="lesson-list">{q.data.map(r => <li key={`${r.kind}:${r.id}`}><Button variant="secondary" disabled={busy} onClick={() => void attach(r)}>{pick(i18n.resolvedLanguage, r.title_en, r.title_es)}</Button></li>)}</ul>}</ResponsiveSheet>}</>;
}
export function CourseResourceReference({ lesson }: { lesson: string }) {
  const { t } = useTranslation();
  const { userId } = useLearn();
  const q = useQuery({ queryKey: ['course-reference', userId, lesson], queryFn: async () => { const r = await supabase.rpc('course_resource_destination', { _lesson: lesson }); if (r.error) throw r.error; return r.data as unknown as { kind: string; id: string } | null; } });
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (q.isPending) return <p role="status">{t('publicEvent.loading')}</p>;
  if (!q.data) return <p role="status">{t('lifecycle.unavailableReference')}</p>;
  return <Button asChild variant="secondary"><Link to="/resource/$kind/$id" params={{ kind: q.data.kind, id: q.data.id }}>{t('resources.open')}</Link></Button>;
}