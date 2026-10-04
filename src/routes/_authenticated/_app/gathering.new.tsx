import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { GatheringForm } from '@/components/gathering-form';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ template: z.string().uuid().optional(), from: z.string().uuid().optional() });
export const Route = createFileRoute('/_authenticated/_app/gathering/new')({
  validateSearch: search,
  head: () => gatherwellHead('events'),
  component: NewGathering,
});
function NewGathering() {
  const { template, from } = Route.useSearch();
  return <GatheringForm key={`${template ?? ''}${from ?? ''}`} templateId={template} fromId={from} />;
}
