import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/copy-button';
import { embedSnippet, embedUrl } from '@/lib/embed';

/** "Embed on your website": live preview, copyable iframe code and plain install steps. */
export function EmbedCodePanel({ slug, name }: { slug: string; name: string }) {
  const { t } = useTranslation(); const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!origin) return null;
  const title = t('embed.iframeTitle', { name }); const code = embedSnippet(origin, slug, title); const src = embedUrl(origin, slug);
  if (!code || !src) return null;
  return <section className="embed-panel" aria-labelledby="embed-title">
    <h3 id="embed-title">{t('embed.title')}</h3>
    <p className="field-hint">{t('embed.intro')}</p>
    <ol className="embed-steps"><li>{t('embed.step1')}</li><li>{t('embed.step2')}</li><li>{t('embed.step3')}</li></ol>
    <label className="field-label" htmlFor="embed-code">{t('embed.code')}</label>
    <textarea id="embed-code" className="field-textarea embed-code" readOnly rows={5} value={code} onFocus={e => e.currentTarget.select()} />
    <CopyButton text={code} label={t('embed.copy')} />
    <p className="field-hint">{t('embed.signInNote')}</p>
    <details><summary>{t('embed.preview')}</summary><iframe src={src} title={title} className="embed-preview" loading="lazy" /></details>
  </section>;
}
