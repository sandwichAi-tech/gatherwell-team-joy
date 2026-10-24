import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, AlertCircle } from '@/components/icons';
import { verifyCertificate } from '@/lib/quizzes';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/verify/$number')({
  head: () => gatherwellHead('verify'),
  component: function VerifyPage() {
    const { number } = Route.useParams();
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'en';
    const q = useQuery({ queryKey: ['verify-cert', number], queryFn: () => verifyCertificate(number) });
    return <main className="guest-shell"><article className="panel verify-panel">
      <h1>{t('cert.verifyTitle')}</h1>
      {q.isPending ? <p className="muted-small">{t('cert.checking')}</p> : !q.data?.valid ? (
        <div role="status"><p className="field-error"><AlertCircle className="inline-icon" />{t('cert.invalid')}</p>
          {q.data?.revoked && <p className="muted-small">{t('cert.revoked')}</p>}
          {q.data?.expired && <p className="muted-small">{t('cert.expired')}</p>}</div>
      ) : (
        <div role="status">
          <p><Check className="inline-icon" />{t('cert.valid')}</p>
          <dl className="verify-details">
            <dt>{t('cert.learner')}</dt><dd>{q.data.learner_name}</dd>
            <dt>{t('cert.course')}</dt><dd>{q.data.course_title}</dd>
            <dt>{t('cert.issuer')}</dt><dd>{q.data.issuer_name}</dd>
            <dt>{t('cert.issuedOn')}</dt><dd>{new Date(q.data.issued_at!).toLocaleDateString(lang === 'es' ? 'es' : 'en')}</dd>
            {q.data.expires_at && <><dt>{t('cert.expiresOn')}</dt><dd>{new Date(q.data.expires_at).toLocaleDateString(lang === 'es' ? 'es' : 'en')}</dd></>}
          </dl>
        </div>
      )}
      <p className="muted-small">{t('cert.verifyNote')}</p>
    </article></main>;
  },
});
