/** QA Lab personas and test-account recognition. Shared by server code and tests; no secrets here. */
export const QA_PERSONAS = [
  { key: 'p1', slug: 'guest', label: 'P1 Guest', account: false, lang: 'en' },
  { key: 'p2', slug: 'attendee', label: 'P2 New attendee', account: true, lang: 'en' },
  { key: 'p3', slug: 'solohost', label: 'P3 Solo host', account: true, lang: 'en' },
  { key: 'p4', slug: 'leader', label: 'P4 Team leader', account: true, lang: 'en' },
  { key: 'p5', slug: 'member', label: 'P5 Team member', account: true, lang: 'en' },
  { key: 'p6', slug: 'cohost', label: 'P6 Co-host', account: true, lang: 'en' },
  { key: 'p7', slug: 'spanish', label: 'P7 Spanish user', account: true, lang: 'es' },
  { key: 'p8', slug: 'guardian', label: 'P8 Guardian', account: true, lang: 'en' },
  { key: 'p9', slug: 'outsider', label: 'P9 Outsider', account: true, lang: 'en' },
  { key: 'p10', slug: 'admin', label: 'P10 Test admin', account: true, lang: 'en' },
] as const;

export const qaEmail = (slug: string) => `zz-test+${slug}@example.com`;
export const qaName = (label: string) => `ZZ-TEST ${label}`;
/** Fake 555-01xx range: +1 310 555 0101 … 0110. */
export const qaPhone = (i: number) => `+1310555${String(101 + i).padStart(4, '0')}`;

/** True for ZZ-TEST names, example.* addresses and 555-01xx phone numbers. */
export function isTestRecipient(recipient: string, name?: string | null) {
  const r = recipient.trim();
  if (/@([a-z0-9-]+\.)*example\.(com|org|net|invalid)$/i.test(r) || /zz-test/i.test(r)) return true;
  if (!r.includes('@') && /55501\d\d$/.test(r.replace(/\D/g, ''))) return true;
  return /^\s*zz-test/i.test(name ?? '');
}

/** Challenge/event checkout: a test account (flagged or by email) may only use Stripe test mode. */
export function blocksTestLiveCheckout(environment: 'sandbox' | 'live', isTestFlag: boolean, email: unknown) {
  return environment === 'live' && (isTestFlag || (typeof email === 'string' && isTestRecipient(email)));
}

/** Stripe live mode must never charge a test account. */
export function blocksLiveCharge(key: string, customerEmail: unknown) {
  return key.startsWith('sk_live') || key.startsWith('rk_live') ? typeof customerEmail === 'string' && isTestRecipient(customerEmail) : false;
}
