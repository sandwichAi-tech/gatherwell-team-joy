/** Reads text from a private lesson PDF that the caller is already allowed to open. Never makes the file public. */
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_TIMEOUT_MS = 15_000;
export const PDF_MAX_PAGES = 60;

export type PdfText = { ok: true; text: string; pages: number; truncated: boolean } | { ok: false; error: 'unsupported' | 'too_large' | 'unreadable' | 'timeout' };

export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  if (bytes.byteLength > PDF_MAX_BYTES) return { ok: false, error: 'too_large' };
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return { ok: false, error: 'unsupported' }; // %PDF
  const work = (async (): Promise<PdfText> => {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    const pages = pdf.numPages;
    const { text } = await extractText(pdf, { mergePages: false });
    const list = (Array.isArray(text) ? text : [text]).slice(0, PDF_MAX_PAGES);
    const joined = list.join('\n\n').replace(/[ \t]+/g, ' ').trim();
    // Scanned/image-only PDFs have no text layer; report that instead of summarizing nothing.
    if (joined.replace(/\s+/g, '').length < 50) return { ok: false, error: 'unreadable' };
    return { ok: true, text: joined.slice(0, 30000), pages, truncated: pages > PDF_MAX_PAGES || joined.length > 30000 };
  })().catch((): PdfText => ({ ok: false, error: 'unreadable' }));
  const timeout = new Promise<PdfText>(resolve => setTimeout(() => resolve({ ok: false, error: 'timeout' }), PDF_TIMEOUT_MS));
  return Promise.race([work, timeout]);
}
