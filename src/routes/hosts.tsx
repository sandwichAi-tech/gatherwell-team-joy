import { createFileRoute } from '@tanstack/react-router';
import { HostsPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
export const Route = createFileRoute('/hosts')({ head: () => ({meta:[{title:i18n.t('marketing.hostsMeta')},{name:'description',content:i18n.t('marketing.hostsSub')}]}),component:HostsPage,errorComponent:({reset})=><RetryState retry={reset}/> });
