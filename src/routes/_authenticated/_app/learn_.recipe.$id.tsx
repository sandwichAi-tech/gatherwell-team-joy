import { createFileRoute } from '@tanstack/react-router';
import { RecipePage } from '@/components/learn';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/learn_/recipe/$id')({ head: () => gatherwellHead('learn'), component: () => <RecipePage id={Route.useParams().id} /> });
