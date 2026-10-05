import { createFileRoute } from '@tanstack/react-router';
import { FollowupInbox } from '@/components/smart';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/followups')({ head: () => gatherwellHead('home'), component: FollowupInbox });
