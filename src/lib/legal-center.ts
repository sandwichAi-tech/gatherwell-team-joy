import type { LegalDoc } from '@/components/auth-frame';

/** Documents with published text live in legalDocs.docs.*; the rest are listed as not yet published (no invented legal copy). */
export type LegalCenterDoc = LegalDoc | 'community' | 'accessibility' | 'refund' | 'safety' | 'copyright';

export const LEGAL_GROUPS: { id: 'everyone' | 'guests' | 'hosts' | 'rights'; docs: LegalCenterDoc[] }[] = [
  { id: 'everyone', docs: ['terms', 'privacy', 'cookies', 'community', 'accessibility'] },
  { id: 'guests', docs: ['guest', 'refund', 'safety', 'sms'] },
  { id: 'hosts', docs: ['host'] },
  { id: 'rights', docs: ['copyright'] },
];

export const PUBLISHED_LEGAL_DOCS: readonly LegalCenterDoc[] = ['terms', 'privacy', 'host', 'guest', 'sms', 'cookies'];

export const LEGAL_VERSION = '1.0';
/** No effective date has been approved yet; set an ISO date here once legal review signs off. */
export const LEGAL_EFFECTIVE_DATE: string | null = null;

export const LEGAL_CONTACTS = ['support', 'privacy', 'legal', 'copyright'] as const;

export function legalPath(doc: LegalCenterDoc): string {
  return doc === 'terms' ? '/terms' : doc === 'privacy' ? '/privacy' : `/legal/${doc}`;
}

export function legalTitleKey(doc: LegalCenterDoc): string {
  return (PUBLISHED_LEGAL_DOCS as readonly string[]).includes(doc) ? `legalDocs.docs.${doc}.title` : `legalCenter.titles.${doc}`;
}

export function sectionId(index: number): string {
  return `section-${index + 1}`;
}
