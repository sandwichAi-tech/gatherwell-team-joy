import { createFileRoute } from '@tanstack/react-router';
import { TrackPage } from '@/components/learn';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/learn_/track/$id')({ head: () => gatherwellHead('learn'), component: () => <TrackPage id={Route.useParams().id} /> });
