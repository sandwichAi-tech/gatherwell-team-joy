import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/')({ head: () => gatherwellHead('home'), component: HomePage });
