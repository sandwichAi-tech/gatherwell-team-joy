import { createFileRoute } from '@tanstack/react-router';
import { MyProgressPage } from '@/components/my-progress';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/progress')({ head: () => gatherwellHead('me'), component: MyProgressPage });
