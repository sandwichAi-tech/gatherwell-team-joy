import { createFileRoute } from '@tanstack/react-router';
import { ChallengePage } from '@/components/challenges';
import { gatherwellHead } from '@/lib/gatherwell-head';
function Page() { const { id } = Route.useParams(); return <ChallengePage key={id} id={id} />; }
export const Route = createFileRoute('/_authenticated/_app/challenge/$id')({ head: () => gatherwellHead('team'), component: Page });
