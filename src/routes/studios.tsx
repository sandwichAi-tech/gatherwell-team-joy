import { createFileRoute } from '@tanstack/react-router';
import { StudiosPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
export const Route = createFileRoute('/studios')({ head: () => ({ meta: [{ title: i18n.t('marketing.studios.meta') }, { name: 'description', content: i18n.t('marketing.studios.metaDesc') }, { property: 'og:title', content: i18n.t('marketing.studios.meta') }, { property: 'og:description', content: i18n.t('marketing.studios.metaDesc') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: StudiosPage, errorComponent: ({ reset }) => <RetryState retry={reset} /> });
