import { createFileRoute, notFound } from '@tanstack/react-router';
import { LEGAL_DOCS, type LegalDoc } from '@/components/auth-frame';
import { LegalDocument } from '@/components/legal-center';
import { legalHead } from '@/lib/legal-head';

export const Route = createFileRoute('/legal/$doc')({
  beforeLoad: ({ params }) => { if (!(LEGAL_DOCS as readonly string[]).includes(params.doc)) throw notFound(); },
  head: ({ params }) => legalHead(`legalDocs.docs.${params.doc}.title`, `legalCenter.summaries.${params.doc}`, `/legal/${params.doc}`),
  component: LegalRoute,
});

function LegalRoute() {
  const { doc } = Route.useParams();
  return <LegalDocument kind={doc as LegalDoc} />;
}
