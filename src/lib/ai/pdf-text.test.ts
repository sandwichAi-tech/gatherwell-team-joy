import { describe, expect, it } from 'vitest';
import { extractPdfText, PDF_MAX_BYTES } from '@/lib/ai/pdf-text.server';

/** Builds a tiny valid one-page PDF with a text layer (or none, to mimic a scan). */
function pdf(text: string | null) {
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET` : '';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n'; const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe('lesson PDF text', () => {
  it('reads the text layer of a real PDF', async () => {
    const r = await extractPdfText(pdf('Breathing practice notes for the Saturday morning group session'));
    expect(r.ok).toBe(true);
    expect(r.ok && r.text).toContain('Breathing practice notes');
  });
  it('reports a scan with no text instead of summarizing nothing', async () => expect(await extractPdfText(pdf(null))).toEqual({ ok: false, error: 'unreadable' }));
  it('refuses non-PDF files', async () => expect(await extractPdfText(new TextEncoder().encode('hello'))).toEqual({ ok: false, error: 'unsupported' }));
  it('refuses files over 10 MB without parsing them', async () => expect(await extractPdfText(new Uint8Array(PDF_MAX_BYTES + 1))).toEqual({ ok: false, error: 'too_large' }));
});
