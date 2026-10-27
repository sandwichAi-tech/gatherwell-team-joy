import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { OfferingCard } from '@/components/follow';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import type { PublicOffering } from '@/lib/public-cards';

export function MyResourceCoaches({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['my-resource-coaches', userId], queryFn: async () => {
    const { data, error } = await supabase.rpc('my_resource_coaches'); if (error) throw error;
    return (data ?? []) as unknown as { id: string; slug: string; name: string; resources: PublicOffering[] }[];
  } });
  return <section className="learn-section"><h2>{t('resourcePlacement.myCoaches')}</h2>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data.length ? <EmptyState compact icon="UsersRound" text={t('resourcePlacement.noCoaches')} /> : q.data.map(c => <section key={c.id} className="learn-section"><h3><Link to="/h/$slug" params={{ slug: c.slug }}>{c.name}</Link></h3>
      <ul className="follow-list offering-cards">{c.resources.map(o => <li key={`${o.entity}:${o.id}`}><OfferingCard o={o} lang={i18n.resolvedLanguage ?? 'en'} /></li>)}</ul>
    </section>)}
  </section>;
}