import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ pages: 1, text: 'ZZ-TEST document', fail: false, cleanup: vi.fn() }));
vi.mock('unpdf', () => ({ getDocumentProxy: async () => {
  if (state.fail) throw new Error('encrypted');
  return { numPages: state.pages, cleanup: state.cleanup, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: state.text }] }) }) };
} }));
import { validateWaiverPdf } from './waiver-pdf.server';
const bytes = () => new TextEncoder().encode('%PDF-1.4 ZZ-TEST');
describe('bounded private waiver PDF validation', () => {
  it('rejects spoofed type/header and oversized input before parsing', async () => {
    expect(await validateWaiverPdf(bytes(), 'text/plain')).toBe(false);
    expect(await validateWaiverPdf(new TextEncoder().encode('not a PDF'), 'application/pdf')).toBe(false);
    expect(await validateWaiverPdf(new Uint8Array(10 * 1024 * 1024 + 1), 'application/pdf')).toBe(false);
  });
  it('allows a readable PDF and cleans the parsed document', async () => {
    state.pages = 1; state.text = 'ZZ-TEST'; state.fail = false;
    expect(await validateWaiverPdf(bytes(), 'application/pdf')).toBe(true); expect(state.cleanup).toHaveBeenCalled();
  });
  it('rejects scans and more than 60 pages honestly', async () => {
    state.text = ''; expect(await validateWaiverPdf(bytes(), 'application/pdf')).toBe(false);
    state.text = 'ZZ-TEST'; state.pages = 61; expect(await validateWaiverPdf(bytes(), 'application/pdf')).toBe(false);
    state.pages = 1;
  });
  it('rejects encryption/corrupt processing failures', async () => {
    state.fail = true; expect(await validateWaiverPdf(bytes(), 'application/pdf')).toBe(false); state.fail = false;
  });
});