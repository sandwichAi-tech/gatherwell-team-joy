import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { personalHomeQuery } from '@/lib/personal-home-query';
import { dailyBriefQuery } from '@/lib/daily-brief-query';
import { RetryState, EmptyState } from '@/components/launch-states';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
function BriefError() { const router = useRouter(); return <RetryState retry={() => void router.invalidate()} />; }
function MissingHome() { const { t } = useTranslation(); return <EmptyState icon="CalendarDays" text={t('smart.brief.empty')} />; }
export const Route = createFileRoute('/_authenticated/_app/home')({
  head: () => gatherwellHead('home'),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(personalHomeQuery(context.user.id)), context.queryClient.ensureQueryData(dailyBriefQuery(context.user.id, 'en')), context.queryClient.ensureQueryData(dailyBriefQuery(context.user.id, 'es'))]); },
  errorComponent: BriefError,
  notFoundComponent: MissingHome,
  component: HomePage,
});
