/** Single source of truth for ZoheeWell company contact details.
 *  Every visible company contact (footer, About, Support, Legal Center) reads
 *  from here so a change happens in exactly one place. Display strings are
 *  language-neutral; labels around them come from translations. */
export const COMPANY = {
  legalName: 'ZoheeWell LLC',
  formation: 'A Wyoming limited liability company',
  mailingAddress: '30 N Gould St, Ste R, Sheridan, WY 82801',
  phoneDisplay: '(949) 630-3386',
  phoneTel: '+19496303386',
  supportEmail: 'support@zoheewell.com',
} as const;

/** tel: href for tap-to-call links. */
export const phoneHref = `tel:${COMPANY.phoneTel}`;

/** Email senders. Every outgoing email reads its From / Reply-To from here. */
export const EMAIL_SENDERS = {
  app: 'ZoheeWell <hello@zoheewell.com>',
  teamAddress: 'team@zoheewell.com',
  replyTo: COMPANY.supportEmail,
} as const;

/** "<Leader first name> on ZoheeWell <team@zoheewell.com>"; header-unsafe characters are removed. */
export function teamAnnouncementFrom(leaderName: string | null | undefined): string {
  const first = (leaderName ?? '').replace(/[<>"\\,;:@\r\n]/g, ' ').trim().split(/\s+/)[0] ?? '';
  return `${first || 'Your team'} on ZoheeWell <${EMAIL_SENDERS.teamAddress}>`;
}

/** Footer line printed on every app email. */
export const EMAIL_FOOTER_ADDRESS = `${COMPANY.legalName} · ${COMPANY.mailingAddress}`;
