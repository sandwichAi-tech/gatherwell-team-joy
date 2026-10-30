import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

/** Shared head metadata for Legal Center pages (title + one-line summary as description). */
export function legalHead(titleKey: string, descKey: string, path: string) {
  const title = `${i18n.t(titleKey)} · ${i18n.t('brand')}`;
  const description = i18n.t(descKey);
  const indexing = publicIndexing(path);
  return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
}
