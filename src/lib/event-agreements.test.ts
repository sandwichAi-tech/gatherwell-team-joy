import { describe, it, expect } from 'vitest';
import { platformSelection, publicHostSlug, safeWaiverPdf } from './event-agreements';
describe('event identity and agreements', () => {
  it('never links an unavailable or unsafe public host identity', () => { expect(publicHostSlug(null)).toBeNull(); expect(publicHostSlug({ slug: '../me' })).toBeNull(); expect(publicHostSlug({ slug: 'host-a' })).toBe('host-a'); });
  it('requires approved availability rather than a product checkbox', () => { expect(platformSelection({ready:false,en_id:'a',es_id:'b',en_url:null,es_url:null,en_version:1,es_version:1}, 'en')).toBeNull(); });
  it('selects the exact separate Spanish reference', () => { expect(platformSelection({ready:true,en_id:'a',es_id:'b',en_url:'https://example.invalid/en',es_url:'https://example.invalid/es',en_version:2,es_version:3}, 'es')?.id).toBe('b'); });
  it('accepts PDF only at the 10 MB limit with PDF bytes', () => { expect(safeWaiverPdf(10485760,'application/pdf','%PDF-')).toBe(true); expect(safeWaiverPdf(10485761,'application/pdf','%PDF-')).toBe(false); expect(safeWaiverPdf(10,'application/pdf','<html')).toBe(false); expect(safeWaiverPdf(10,'text/html','%PDF-')).toBe(false); });
});