import { createFileRoute } from '@tanstack/react-router';
import { PublicResource } from '@/components/public-resource';
export const Route = createFileRoute('/resource/$kind/$id')({
  head: () => ({ meta: [{ title: 'Resources · ZoheeWell' }, { name: 'description', content: 'Open a resource from your ZoheeWell coach.' }, { property: 'og:title', content: 'Resources · ZoheeWell' }, { property: 'og:description', content: 'Open a resource from your ZoheeWell coach.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: function Page() { const { kind, id } = Route.useParams(); return <PublicResource kind={kind === 'recipe' || kind === 'quiz' || kind === 'offer' ? kind : 'track'} id={id} />; },
});