import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LandingPage } from '@/components/landing/landing-page';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/')({
  loader: () => publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null),
  head: ({ loaderData }) => {
    const title = i18n.t('landing.meta.homeTitle');
    const description = i18n.t('landing.meta.home');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }, ...(loaderData ? [{ property: 'og:image', content: loaderData }, { name: 'twitter:image', content: loaderData }] : [])] };
  },
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
  component: function PublicHome() {
    const navigate = useNavigate();
    useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: '/home', replace: true }); }); }, [navigate]);
    return <LandingPage />;
  },
});
