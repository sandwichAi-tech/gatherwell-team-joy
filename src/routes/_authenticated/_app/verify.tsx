import { createFileRoute } from '@tanstack/react-router';
import { VerifyPage } from '@/components/coach-trust';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/verify')({ head: () => gatherwellHead('me'), component: VerifyPage });
