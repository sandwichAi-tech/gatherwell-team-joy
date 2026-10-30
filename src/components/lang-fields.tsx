import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Languages } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslateFill } from '@/lib/assistant-client';
import { activeLang, otherLang, type ContentLang } from '@/lib/lang-fields';

type PairProps = {
  id: string;
  label: string;
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string | undefined;
};

/**
 * One content field in a single language at a time. Defaults to the creator's UI language; an
 * EN/ES switch edits the other translation in the same box. Both values live in the parent state,
 * so switching never discards text, and the hidden language is never required.
 */
export function LangPair({ id, label, en, es, onEn, onEs, multiline, rows = 3, maxLength, placeholder }: PairProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<ContentLang>(() => activeLang(i18n.resolvedLanguage));
  const values: Record<ContentLang, string> = { en, es };
  const setters: Record<ContentLang, (v: string) => void> = { en: onEn, es: onEs };
  const other = otherLang(editing);
  const tr = useTranslateFill();
  const langName = (l: ContentLang) => t(l === 'es' ? 'me.spanish' : 'me.english');
  const shared = {
    id, className: multiline ? 'field-textarea' : 'field-input', maxLength, value: values[editing], placeholder, lang: editing,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setters[editing](e.target.value),
  };
  return <div className="form-field lang-pair">
    <div className="lang-pair-head">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="lang-switch" role="group" aria-label={t('langFields.editing', { field: label })}>
        {(['en', 'es'] as const).map(l => <button key={l} type="button" className={editing === l ? 'is-active' : ''} aria-pressed={editing === l} aria-label={`${langName(l)}${values[l].trim() ? ` · ${t('langFields.filled')}` : ''}`} onClick={() => setEditing(l)}>{l.toUpperCase()}{values[l].trim() ? <span className="lang-dot" aria-hidden="true" /> : null}</button>)}
      </div>
    </div>
    {multiline ? <Textarea rows={rows} {...shared} /> : <Input {...shared} />}
    {!values[editing].trim() && values[other].trim() && <button type="button" className="translate-button" disabled={tr.busy} onClick={() => void tr.run(other === 'en' ? values.en : '', other === 'es' ? values.es : '', onEn, onEs)}>
      <Languages />{tr.busy ? t('assistant.translating') : t('langFields.translateFrom', { lang: langName(other) })}
    </button>}
    {tr.preview && <small className="not-connected">{t('assistant.previewTranslateNote')}</small>}
  </div>;
}

type FieldsProps = {
  idPrefix: string;
  titleEn: string; titleEs: string; descEn: string; descEs: string;
  onChange: (patch: { titleEn?: string; titleEs?: string; descEn?: string; descEs?: string }) => void;
  titleLabel: string;
  descLabel: string;
  titleMax?: number;
  descMax?: number;
  descRows?: number;
  titlePlaceholder?: string;
  descPlaceholder?: string;
  translate?: boolean;
};

/** Active-language Title + Description with an optional one-click fill of the empty side. */
export function LangFields({ idPrefix, titleEn, titleEs, descEn, descEs, onChange, titleLabel, descLabel, titleMax = 120, descMax = 1000, descRows = 3, titlePlaceholder, descPlaceholder, translate = true }: FieldsProps) {
  const { t } = useTranslation();
  const tr = useTranslateFill();
  const [busy, setBusy] = useState(false);
  const fill = async () => {
    setBusy(true);
    try {
      await tr.run(titleEn, titleEs, v => onChange({ titleEn: v }), v => onChange({ titleEs: v }));
      await tr.run(descEn, descEs, v => onChange({ descEn: v }), v => onChange({ descEs: v }));
    } catch { toast.error(t('error.message')); } finally { setBusy(false); }
  };
  return <>
    <LangPair id={`${idPrefix}-title`} label={titleLabel} en={titleEn} es={titleEs} onEn={v => onChange({ titleEn: v })} onEs={v => onChange({ titleEs: v })} maxLength={titleMax} placeholder={titlePlaceholder} />
    <LangPair id={`${idPrefix}-desc`} label={descLabel} en={descEn} es={descEs} onEn={v => onChange({ descEn: v })} onEs={v => onChange({ descEs: v })} multiline rows={descRows} maxLength={descMax} placeholder={descPlaceholder} />
    {translate && <div className="label-row">
      <button type="button" className="translate-button" disabled={busy} onClick={fill}><Languages />{busy ? t('assistant.translating') : t('templates.translate')}</button>
      {tr.preview && <small className="not-connected">{t('assistant.previewTranslateNote')}</small>}
    </div>}
  </>;
}
