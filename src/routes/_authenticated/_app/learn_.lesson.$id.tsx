import { createFileRoute } from '@tanstack/react-router';
import { LessonPage } from '@/components/learn';
import { gatherwellHead } from '@/lib/gatherwell-head';
function Page() { const { id } = Route.useParams(); return <LessonPage key={id} id={id} />; }
export const Route = createFileRoute('/_authenticated/_app/learn_/lesson/$id')({ head: () => gatherwellHead('learn'), component: Page });
