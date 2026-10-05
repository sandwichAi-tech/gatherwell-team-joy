import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { LandingPage } from '@/components/landing/landing-page';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: '/home', replace: true });
  },
  head: () => {
    const title = i18n.t('landing.meta.homeTitle');
    const description = i18n.t('landing.meta.home');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
  },
  component: LandingPage,
});
