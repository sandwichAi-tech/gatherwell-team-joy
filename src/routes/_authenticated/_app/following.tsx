import { createFileRoute } from '@tanstack/react-router';
import { FollowingPage } from '@/components/host-profile';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/following')({
  head: () => ({ meta: [{ title: `${i18n.t('following.title')} · ${i18n.t('brand')}` }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: FollowingPage,
});
