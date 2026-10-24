import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GuestShell } from '@/components/guest-shell';
import { savePendingHostInvite } from '@/lib/discovery';
import i18n from '@/lib/i18n';

/** Invite-a-host landing: remembers the opaque token (short-lived, never authority) and sends the visitor to sign up. */
export const Route = createFileRoute('/i/host/$token')({
  head: () => {
    const title = `${i18n.t('home.explore.inviteTitle')} · ${i18n.t('brand')}`;
    return { meta: [{ title }, { name: 'description', content: i18n.t('home.explore.inviteText') }, { property: 'og:title', content: title }, { property: 'og:type', content: 'website' }, { name: 'robots', content: 'noindex' }] };
  },
  component: function HostInviteRedirect() {
    const { t } = useTranslation();
    const { token } = Route.useParams();
    const navigate = useNavigate();
    useEffect(() => {
      if (/^[A-Z0-9]{6,20}$/i.test(token)) savePendingHostInvite(token.toUpperCase());
      void navigate({ to: '/login', search: { intent: 'host' }, replace: true });
    }, [token, navigate]);
    return <GuestShell><p className="guest-empty">{t('welcome.inviteLoading')}</p></GuestShell>;
  },
});
