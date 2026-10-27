// Host forms library: shared types and pure helpers (mirrors 0188 save_host_form / safe_form_file_name).
export const FORM_KINDS = ['waiver', 'release', 'media', 'other'] as const;
export type FormKind = (typeof FORM_KINDS)[number];
export const FORM_DESCRIPTION_MAX = 500;
export const FORM_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Display-only file name: no folders, only safe characters, always ".pdf". */
export function safeFormFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9 ._-]+/g, '-').replace(/^[ .-]+|[ .-]+$/g, '');
  return `${(base || 'document').slice(0, 100)}.pdf`;
}

/** Languages with entered text; a PDF-only form returns []. */
export const formLanguages = (w: { body_en: string; body_es: string }) =>
  [w.body_en.trim() ? 'en' : '', w.body_es.trim() ? 'es' : ''].filter(Boolean) as ('en' | 'es')[];
