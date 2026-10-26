import { describe, expect, it } from 'vitest';
import { emptyMediaKey, isPdfPath, viewerFor } from '@/lib/learn';
import { fileMatchesLessonType } from '@/lib/create-resource';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const L = (p: Partial<{ type: string; url: string | null; storage_path: string | null; replay_url: string | null }>) =>
  ({ type: 'video', url: null, storage_path: null, replay_url: null, ...p });

describe('row 60: PDF resources never use the video layout', () => {
  it('uploaded PDF lesson opens the document viewer', () => expect(viewerFor(L({ type: 'pdf', storage_path: 'team/a/guide.pdf' }))).toBe('document'));
  it('a PDF stored under a video lesson still opens as a document', () => expect(viewerFor(L({ type: 'video', storage_path: 'team/a/guide.PDF' }))).toBe('document'));
  it('PDF link opens as a document', () => expect(viewerFor(L({ type: 'pdf', url: 'https://x.org/a.pdf?sig=1' }))).toBe('document'));
  it('empty PDF lesson is empty, with document wording not video wording', () => {
    expect(viewerFor(L({ type: 'pdf' }))).toBe('none');
    expect(emptyMediaKey(L({ type: 'pdf' }))).toBe('learnHub.noPdf');
    expect(en.learnHub.noPdf).not.toMatch(/video/i);
  });
  it('real video stays a video; non-PDF files download', () => {
    expect(viewerFor(L({ type: 'video', storage_path: 't/a/clip.mp4' }))).toBe('video');
    expect(viewerFor(L({ type: 'file', storage_path: 't/a/pack.zip' }))).toBe('download');
  });
  it('pdf detection ignores query strings', () => { expect(isPdfPath('a.pdf?token=1')).toBe(true); expect(isPdfPath('a.pdfx')).toBe(false); });
  it('uploads must match the lesson type', () => {
    expect(fileMatchesLessonType('pdf', { type: 'application/pdf', name: 'g.pdf' })).toBe(true);
    expect(fileMatchesLessonType('video', { type: 'application/pdf', name: 'g.pdf' })).toBe(false);
    expect(fileMatchesLessonType('pdf', { type: 'video/mp4', name: 'c.mp4' })).toBe(false);
  });
  it('document viewer copy exists in EN and ES', () => {
    for (const k of ['noPdf', 'docLoading', 'docError', 'docHint', 'openPdf', 'downloadPdf', 'wrongFileType'] as const) {
      expect(en.learnHub[k]).toBeTruthy(); expect(es.learnHub[k]).toBeTruthy();
    }
  });
});
