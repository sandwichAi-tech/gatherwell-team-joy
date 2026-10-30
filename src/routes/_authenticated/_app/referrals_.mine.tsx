import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { MyReferralsPage } from '@/components/referrals';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/referrals_/mine')({ head: () => gatherwellHead('me', 'referral.mine.title'), component: () => <FeatureRoute flag="feature_referrals"><MyReferralsPage /></FeatureRoute> });
