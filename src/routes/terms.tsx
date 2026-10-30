import { createFileRoute } from '@tanstack/react-router';
import { LegalDocument } from '@/components/legal-center';
import { legalHead } from '@/lib/legal-head';

export const Route = createFileRoute('/terms')({
  head: () => legalHead('legalDocs.docs.terms.title', 'legalCenter.summaries.terms', '/terms'),
  component: () => <LegalDocument kind="terms" />,
});
