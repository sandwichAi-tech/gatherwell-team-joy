import { createFileRoute } from '@tanstack/react-router';
import { StudiosPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
export const Route = createFileRoute('/studios')({ head: () => ({ meta: [{ title: i18n.t('marketing.studios.meta') }, { name: 'description', content: i18n.t('marketing.studios.metaDesc') }] }), component: StudiosPage, errorComponent: ({ reset }) => <RetryState retry={reset} /> });
