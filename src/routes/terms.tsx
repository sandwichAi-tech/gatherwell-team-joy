import { createFileRoute } from '@tanstack/react-router';
import { LegalPage, pageHead } from '@/components/auth-frame';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/terms')({
  head: () => { const h = pageHead('legal.termsTitle', 'meta.terms'); const indexing = publicIndexing('/terms'); return { meta: [...h.meta, ...indexing.meta], links: indexing.links }; },
  component: () => <LegalPage kind="terms" />,
});
