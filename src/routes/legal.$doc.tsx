import { createFileRoute, notFound } from '@tanstack/react-router';
import { LEGAL_DOCS, LegalPage, type LegalDoc } from '@/components/auth-frame';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/legal/$doc')({
  beforeLoad: ({ params }) => { if (!(LEGAL_DOCS as readonly string[]).includes(params.doc)) throw notFound(); },
  head: ({ params }) => {
    const title = `${i18n.t(`legalDocs.docs.${params.doc}.title`)} · ${i18n.t('brand')}`;
    const description = i18n.t('legalDocs.draft');
    const indexing = publicIndexing(`/legal/${params.doc}`);
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: LegalRoute,
});

function LegalRoute() {
  const { doc } = Route.useParams();
  return <LegalPage kind={doc as LegalDoc} />;
}
