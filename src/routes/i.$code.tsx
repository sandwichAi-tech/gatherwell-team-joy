import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GuestShell } from '@/components/guest-shell';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { rememberInvite } from '@/lib/welcome';
import { inviteLanding } from '@/lib/profile-ia';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/i/$code')({
  head: () => {
    const title = `${i18n.t('welcome.inviteTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('welcome.inviteMeta');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: InviteLanding,
});

/** Friend invitation landing: remembers the code for the next RSVP and offers sign-up or browsing. Never reveals who invited. */
function InviteLanding() {
  const { t } = useTranslation();
  const { code } = Route.useParams();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { rememberInvite(code); void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, [code]);
  const plan = inviteLanding(code, !!signedIn);
  return <GuestShell><article className="guest-body invite-landing">
    <section className="guest-card">
      <h1 className="guest-title">{t(plan.valid ? 'welcome.landing.title' : 'welcome.landing.invalidTitle')}</h1>
      <p className="auth-subtitle">{t(plan.valid ? 'welcome.landing.body' : 'welcome.landing.invalidBody')}</p>
      <div className="guest-button-row">
        <Button asChild><Link to="/discover">{t('welcome.landing.browse')}</Link></Button>
        {signedIn === false && plan.signup && <Button asChild variant="secondary"><Link to="/login" search={plan.signup.search}>{t('welcome.landing.signup')}</Link></Button>}
      </div>
      {signedIn && <p className="field-hint" role="status">{t('welcome.landing.signedIn')}</p>}
    </section>
  </article></GuestShell>;
}
