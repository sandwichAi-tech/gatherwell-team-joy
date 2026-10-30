/** Single source of truth for ZoheeWell company contact details.
 *  Every visible company contact (footer, About, Support) reads from here so a
 *  change happens in exactly one place. Display strings are language-neutral. */
export const COMPANY = {
  legalName: 'ZoheeWell LLC',
  phoneDisplay: '(949) 630-3386',
  phoneTel: '+19496303386',
  supportEmail: 'support@zoheewell.com',
} as const;

/** tel: href for tap-to-call links. */
export const phoneHref = `tel:${COMPANY.phoneTel}`;
