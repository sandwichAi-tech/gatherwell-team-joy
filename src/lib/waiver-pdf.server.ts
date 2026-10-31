import { safeWaiverPdf } from './event-agreements';
/** Structural/readability check, not a malware-scan claim. No public upload or OCR. */
export async function validateWaiverPdf(bytes: Uint8Array, mime: string): Promise<boolean> {
  if (!safeWaiverPdf(bytes.length, mime, new TextDecoder().decode(bytes.slice(0, 5)))) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    try {
      if (pdf.numPages < 1 || pdf.numPages > 60) return false;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const text = await page.getTextContent();
        if (text.items.some(item => 'str' in item && item.str.trim().length > 0)) return true;
      }
      return false;
    } finally { await pdf.destroy(); }
  })().catch(() => false);
  try { return await Promise.race([work, new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 15000); })]); }
  finally { if (timer) clearTimeout(timer); }
}