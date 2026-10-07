import { createFileRoute } from '@tanstack/react-router';
import { PricingPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
export const Route = createFileRoute('/pricing')({head:()=>({meta:[{title:i18n.t('marketing.pricingMeta')},{name:'description',content:i18n.t('marketing.pricingSub')}]}),component:PricingPage,errorComponent:({reset})=><RetryState retry={reset}/>});
