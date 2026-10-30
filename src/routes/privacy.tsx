import { createFileRoute } from '@tanstack/react-router';
import { LegalDocument } from '@/components/legal-center';
import { legalHead } from '@/lib/legal-head';

export const Route = createFileRoute('/privacy')({
  head: () => legalHead('legalDocs.docs.privacy.title', 'legalCenter.summaries.privacy', '/privacy'),
  component: () => <LegalDocument kind="privacy" />,
});
