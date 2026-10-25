import { createFileRoute } from '@tanstack/react-router';
import { LegalPage, pageHead } from '@/components/auth-frame';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/privacy')({
  head: () => { const h = pageHead('legal.privacyTitle', 'meta.privacy'); const indexing = publicIndexing('/privacy'); return { meta: [...h.meta, ...indexing.meta], links: indexing.links }; },
  component: () => <LegalPage kind="privacy" />,
});
