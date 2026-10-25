import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, Link2, List, Type } from '@/components/icons';
import { sanitizeRichText } from '@/lib/resource-item';

/**
 * Small rich-text editor for promotional landing copy. A toolbar wraps the current
 * selection in a constrained HTML subset (headings, bold/italic, lists, safe links);
 * the value is sanitized again on save and before any preview render.
 */
export function RichTextEditor({ id, label, value, onChange, rows = 6 }: {
  id: string; label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after: string, perLine = false) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || t('resources.item.richTextHint');
    const next = perLine
      ? before + sel.split('\n').map(l => `<li>${l}</li>`).join('') + after
      : before + sel + after;
    const out = value.slice(0, s) + next + value.slice(e);
    onChange(out);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };

  const tools = [
    { key: 'h', icon: Type, label: t('resources.item.rtHeading'), run: () => wrap('<h3>', '</h3>') },
    { key: 'b', icon: Bold, label: t('resources.item.rtBold'), run: () => wrap('<strong>', '</strong>') },
    { key: 'i', icon: Italic, label: t('resources.item.rtItalic'), run: () => wrap('<em>', '</em>') },
    { key: 'ul', icon: List, label: t('resources.item.rtList'), run: () => wrap('<ul>', '</ul>', true) },
    { key: 'a', icon: Link2, label: t('resources.item.rtLink'), run: () => wrap('<a href="https://">', '</a>') },
  ];

  return <div className="form-field rich-editor">
    <span className="field-label" id={`${id}-label`}>{label}</span>
    <div className="rich-toolbar" role="toolbar" aria-label={label}>
      {tools.map(tool => <button type="button" key={tool.key} className="rich-tool" title={tool.label} aria-label={tool.label} onClick={tool.run}><tool.icon aria-hidden="true" /></button>)}
    </div>
    <textarea ref={ref} id={id} rows={rows} className="field-textarea rich-input" value={value} maxLength={8000}
      aria-labelledby={`${id}-label`} onChange={e => onChange(e.target.value)} />
    <p className="field-hint">{t('resources.item.richTextSafe')}</p>
  </div>;
}

/** Safe render of promotional copy: always through the sanitizer. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;
  // eslint-disable-next-line react/no-danger -- sanitized to a strict allowlist above
  return <div className={className ?? 'rich-text'} dangerouslySetInnerHTML={{ __html: clean }} />;
}
