import { createFileRoute } from '@tanstack/react-router';
import { SavedPage } from '@/components/saved';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/saved')({
  head: () => {
    const base = gatherwellHead('me');
    return { ...base, meta: [...base.meta, { name: 'robots', content: 'noindex, nofollow' }] };
  },
  component: SavedPage,
});
