import { describe, expect, it } from 'vitest';
import { COMPANY, phoneHref } from '@/lib/company';

describe('company contact details', () => {
  it('keeps the tap-to-call href in step with the displayed number', () => {
    const digits = COMPANY.phoneDisplay.replace(/\D/g, '');
    expect(COMPANY.phoneTel).toBe(`+1${digits}`);
    expect(phoneHref).toBe(`tel:${COMPANY.phoneTel}`);
  });

  it('shows the number the same way in every language', () => {
    expect(COMPANY.phoneDisplay).toBe('(949) 630-3386');
    expect(COMPANY.legalName).toBe('ZoheeWell LLC');
    expect(COMPANY.supportEmail).toBe('support@zoheewell.com');
  });

  it('carries the owner-supplied legal entity and mailing address', () => {
    expect(COMPANY.formation).toBe('A Wyoming limited liability company');
    expect(COMPANY.mailingAddress).toBe('30 N Gould St, Ste R, Sheridan, WY 82801');
  });
});
