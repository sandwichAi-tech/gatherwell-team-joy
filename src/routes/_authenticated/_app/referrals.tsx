import { createFileRoute } from '@tanstack/react-router';
import { CoachReferralsPage } from '@/components/referrals';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/referrals')({ head: () => gatherwellHead('me', 'referral.coach.title'), component: CoachReferralsPage });
