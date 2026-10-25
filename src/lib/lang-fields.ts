/** Active-language creator fields: one field in the creator's language, optional second-language translation. */

export type ContentLang = 'en' | 'es';

/** UI language decides which side of a bilingual pair is the primary editing field. */
export const activeLang = (resolved?: string | undefined): ContentLang => (resolved === 'es' ? 'es' : 'en');

export const otherLang = (lang: ContentLang): ContentLang => (lang === 'es' ? 'en' : 'es');

/**
 * Show both language fields only when the other language already holds content
 * (existing bilingual records must display fully) or the creator asked to add a translation.
 */
export const showBothLanguages = (otherValue: string, expanded: boolean): boolean => expanded || otherValue.trim().length > 0;

/** A bilingual record is valid when at least one side has a title; hidden sides are never required. */
export const hasAnyTitle = (en: string, es: string): boolean => !!(en.trim() || es.trim());
