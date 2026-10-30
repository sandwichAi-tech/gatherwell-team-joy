import { createFileRoute } from '@tanstack/react-router';
import { LegalCenterPage } from '@/components/legal-center';
import { legalHead } from '@/lib/legal-head';

export const Route = createFileRoute('/legal/')({
  head: () => legalHead('legalCenter.title', 'legalCenter.metaDesc', '/legal'),
  component: LegalCenterPage,
});
