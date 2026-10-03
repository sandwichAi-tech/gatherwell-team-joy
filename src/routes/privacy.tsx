import { createFileRoute } from '@tanstack/react-router';
import { LegalPage, pageHead } from '@/components/auth-frame';

export const Route = createFileRoute('/privacy')({ head: () => pageHead('legal.privacyTitle', 'meta.privacy'), component: () => <LegalPage kind="privacy" /> });
