import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { OfferCover } from '@/components/offers';
import { ChevronRight } from '@/components/icons';
import { isLive, offerTitle, purchasesQuery } from '@/lib/offers';

export const Route = createFileRoute('/_authenticated/_app/circles')({
  head: () => {
    const title = `${i18n.t('myCircles.title')} · ${i18n.t('brand')}`; const description = i18n.t('myCircles.meta');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
  },
  component: MyCircles,
});

function MyCircles() {
  const { t, i18n: { resolvedLanguage: lang } } = useTranslation();
  const { user } = Route.useRouteContext();
  const q = useQuery(purchasesQuery(user.id));
  const circles = (q.data ?? []).filter(p => p.offer?.kind === 'membership' && isLive(p));
  return <>
    <div className="page-heading"><div><h1>{t('myCircles.title')}</h1></div></div>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !circles.length
      ? <EmptyState icon="UsersRound" title={t('myCircles.empty')} text={t('myCircles.emptyText')} action={<Button asChild><Link to="/discover">{t('myCircles.browse')}</Link></Button>} />
      : <ul className="offer-list">{circles.map(p => <li key={p.id}><Link to="/offer/$id" params={{ id: p.offer_id }} className="offer-row is-link"><OfferCover offer={p.offer!} /><div className="offer-row-main"><strong>{offerTitle(p.offer!, lang)}</strong></div><ChevronRight /></Link></li>)}</ul>}
  </>;
}
