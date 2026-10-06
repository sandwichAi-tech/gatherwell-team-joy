import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GuestShell } from '@/components/guest-shell';
import { rememberInvite } from '@/lib/welcome';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/i/$code')({
  head: () => {
    const title = `${i18n.t('welcome.inviteTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('welcome.inviteMeta');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: InviteRedirect,
});

function InviteRedirect() {
  const { t } = useTranslation();
  const { code } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => { rememberInvite(code); void navigate({ to: '/discover', replace: true }); }, [code, navigate]);
  return <GuestShell><p className="guest-empty">{t('welcome.inviteLoading')}</p></GuestShell>;
}
