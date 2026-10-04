import { createFileRoute } from '@tanstack/react-router';
import { GatheringForm } from '@/components/gathering-form';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/gathering/$id/edit')({
  head: () => gatherwellHead('events'),
  component: EditGathering,
});
function EditGathering() {
  const { id } = Route.useParams();
  return <GatheringForm key={id} eventId={id} />;
}
