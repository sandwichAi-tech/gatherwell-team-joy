import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AuthFrame, pageHead } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';
import { clearPendingInvite, initialsOf, parseJoinCode, savePendingInvite } from '@/lib/account';
import { JOIN_BY_KEY } from '@/lib/recognition';
import { publicShareImage } from '@/lib/public-media.functions';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/join/$code')({
  loader: () => publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null),
  head: ({ loaderData }) => { const h = pageHead('join.cta', 'meta.join'); return { meta: [...h.meta, ...(loaderData ? [{ property: 'og:image', content: loaderData }, { name: 'twitter:image', content: loaderData }] : [])] }; },
  errorComponent: ({ reset }) => <AuthFrame><RetryState retry={reset} /></AuthFrame>,
  notFoundComponent: () => <AuthFrame>{i18n.t('join.invalid')}</AuthFrame>,
  component: JoinPage,
});

function JoinPage() {
  const { t } = useTranslation();
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'invalid' | { team: string; leader: string | null }>('loading');

  useEffect(() => {
    const clean = parseJoinCode(code);
    void supabase.rpc('get_team_invite', { _code: clean }).then(async ({ data }) => {
      const invite = data?.[0];
      if (!invite) { clearPendingInvite(); setState('invalid'); return; }
      savePendingInvite(clean);
      const by = new URLSearchParams(window.location.search).get('by');
      if (by && /^[0-9a-f-]{36}$/i.test(by)) localStorage.setItem(JOIN_BY_KEY, by); else localStorage.removeItem(JOIN_BY_KEY);
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) { void navigate({ to: '/onboarding', replace: true }); return; }
      setState({ team: invite.team_name, leader: invite.leader_name });
    });
  }, [code, navigate]);

  return <AuthFrame>
    {state === 'loading' && <p className="auth-subtitle">{t('join.loading')}</p>}
    {state === 'invalid' && <><h1 className="auth-title">{t('error.notFound')}</h1><p className="auth-subtitle">{t('join.invalid')}</p></>}
    {typeof state === 'object' && <>
      <span className="eyebrow">{t('join.eyebrow')}</span>
      <h1 className="auth-title">{t('join.title', { team: state.team })}</h1>
      {state.leader && <div className="leader-line"><span className="initial-avatar">{initialsOf(state.leader)}</span><span>{t('join.led', { name: state.leader })}</span></div>}
      <p className="auth-subtitle">{t('join.text')}</p>
      <Button asChild className="auth-button"><Link to="/login">{t('join.cta')}</Link></Button>
      <Button variant="link" className="auth-link" onClick={() => { clearPendingInvite(); void navigate({ to: '/' }); }}>{t('join.cancel')}</Button>
    </>}
  </AuthFrame>;
}
