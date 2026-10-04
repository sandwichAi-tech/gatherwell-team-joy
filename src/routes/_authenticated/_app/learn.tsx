import { createFileRoute } from '@tanstack/react-router';
import { LearnHome } from '@/components/learn';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/learn')({ head: () => gatherwellHead('learn'), component: LearnHome });
