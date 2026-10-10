import { createFileRoute } from '@tanstack/react-router';
import { QuickStartPage, type StartSearch } from '@/components/quick-start';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/start')({
  head: () => gatherwellHead('home'),
  validateSearch: (s: Record<string, unknown>): StartSearch => {
    const step = Number(s['step']);
    return {
      ...([1, 2, 3, 4].includes(step) ? { step: step as 1 | 2 | 3 | 4 } : {}),
      ...(s['kind'] === 'free' || s['kind'] === 'paid' || s['kind'] === 'circle' ? { kind: s['kind'] } : {}),
      ...(typeof s['id'] === 'string' && /^[0-9a-f-]{36}$/.test(s['id']) ? { id: s['id'] } : {}),
    };
  },
  component: function Start() { return <QuickStartPage search={Route.useSearch()} />; },
});
