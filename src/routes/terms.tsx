import { createFileRoute } from '@tanstack/react-router';
import { LegalPage, pageHead } from '@/components/auth-frame';

export const Route = createFileRoute('/terms')({ head: () => pageHead('legal.termsTitle', 'meta.terms'), component: () => <LegalPage kind="terms" /> });
