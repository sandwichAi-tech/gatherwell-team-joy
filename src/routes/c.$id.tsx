import { createFileRoute } from '@tanstack/react-router';
import { PublicChallengePage, publicChallengeQuery } from '@/components/public-challenge';
export const Route = createFileRoute('/c/$id')({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(publicChallengeQuery(params.id)),
  head: ({ loaderData }) => { const title = `${loaderData?.title_en || 'Challenge'} · ZoheeWell`; const description = loaderData?.description_en || 'ZoheeWell community challenge.'; return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }; },
  errorComponent: () => <p role="alert">ZoheeWell challenge unavailable.</p>,
  notFoundComponent: () => <p>ZoheeWell challenge unavailable.</p>,
  component: () => <PublicChallengePage key={Route.useParams().id} id={Route.useParams().id} />,
});