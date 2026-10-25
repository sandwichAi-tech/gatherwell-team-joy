import i18n from './i18n';
import { NOINDEX_META } from './seo';

// Every consumer of this helper is a signed-in app route, so all of them are noindex.
export function gatherwellHead(page: 'home' | 'events' | 'team' | 'learn' | 'me' | 'insights', sectionKey?: string) {
  const title = `${sectionKey ? `${i18n.t(sectionKey)} · ` : ''}${i18n.t(`nav.${page}`)} · ${i18n.t('brand')}`;
  const description = i18n.t(`meta.${page}`);
  return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }, { ...NOINDEX_META }] };
}
