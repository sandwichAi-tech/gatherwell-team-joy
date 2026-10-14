import { describe, expect, it } from 'vitest';
import { asRefundPolicy, refundText } from './refunds';
describe('refund rule', () => {
  it('defaults unknown values to 24 hours', () => expect(asRefundPolicy('x')).toBe('24h'));
  it('no-refund rule still promises a full refund if the host cancels', () => expect(refundText('none', 'en')).toBe('No refunds. If the host cancels, you get a full refund.'));
  it('Spanish 7-day rule', () => expect(refundText('7d', 'es')).toContain('7 días antes'));
});
