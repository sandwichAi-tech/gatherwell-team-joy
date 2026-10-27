import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { FeatureRoute } from '@/lib/feature-flags';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { QuizStudio } from '@/components/quiz-studio';
import { QuizPlay } from '@/components/quiz-play';
import { WellnessAssessmentBuilder } from '@/components/wellness-assessment-builder';
import { WellnessAssessmentPlay } from '@/components/wellness-assessment-play';

/** One address per quiz: its editor opens the studio, everyone else gets the participant flow (access checked in the database). */
function QuizRoute() {
  const { id } = Route.useParams();
  const edit = useQuery({ queryKey: ['quiz-can-edit', id], queryFn: async () => { const { data, error } = await supabase.rpc('can_edit_quiz', { _quiz: id }); if (error) throw error; return data === true; } });
  const kind = useQuery({ queryKey: ['quiz-resource-kind', id], queryFn: async () => { const r = await supabase.rpc('quiz_is_assessment', { _quiz: id }); if (r.error) throw r.error; return r.data === true; } });
  if (edit.isPending) return <ListSkeleton />;
  if (edit.isError) return <RetryState retry={() => void edit.refetch()} />;
  if (edit.data && kind.isPending) return <ListSkeleton />;
  if (kind.isError) return <RetryState retry={() => void kind.refetch()} />;
  if (edit.data && kind.data) return <WellnessAssessmentBuilder id={id} />;
  if (!edit.data && kind.data) return <WellnessAssessmentPlay id={id} />;
  return edit.data ? <QuizStudio quizId={id} /> : <QuizPlay quizId={id} />;
}

export const Route = createFileRoute('/_authenticated/_app/learn_/quiz/$id')({
  head: () => gatherwellHead('learn', 'quizStudio.pageTitle'),
  component: () => <FeatureRoute flag="feature_learn"><QuizRoute /></FeatureRoute>,
});
