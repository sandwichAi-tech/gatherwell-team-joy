import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Languages, Plus, X } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslateFill } from '@/lib/assistant-client';
import { activeLang, otherLang, showBothLanguages, type ContentLang } from '@/lib/lang-fields';

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
  placeholder?: string;
};

/**
 * One Title/Description-style field in the creator's active language. The other language stays
 * hidden behind an "Add translation" action unless it already holds content; entered text is
 * never discarded by switching — both sides live in the parent's state and save together.
 */
export function LangPair({ id, label, en, es, onEn, onEs, multiline, rows = 3, maxLength, placeholder }: PairProps) {
  const { t, i18n } = useTranslation();
  const active = activeLang(i18n.resolvedLanguage);
  const other = otherLang(active);
  const [expanded, setExpanded] = useState(false);
  const values: Record<ContentLang, string> = { en, es };
  const setters: Record<ContentLang, (v: string) => void> = { en: onEn, es: onEs };
  const both = showBothLanguages(values[other], expanded);

  const field = (lang: ContentLang) => {
    const fieldId = both ? `${id}-${lang}` : id;
    const fieldLabel = both ? `${label} · ${lang.toUpperCase()}` : label;
    const shared = {
      id: fieldId,
      className: multiline ? 'field-textarea' : 'field-input',
      maxLength,
      value: values[lang],
      placeholder,
      'aria-label': fieldLabel,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setters[lang](e.target.value),
    };
    return <div className="form-field" key={lang}>
      <label className="field-label" htmlFor={fieldId}>{fieldLabel}</label>
      {multiline ? <Textarea rows={rows} {...shared} /> : <Input {...shared} />}
    </div>;
  };

  return <div className="lang-pair">
    {both ? <div className="bilingual">{field(active)}{field(other)}</div> : field(active)}
    {!both && <button type="button" className="translate-button" onClick={() => setExpanded(true)}>
      <Plus />{t('langFields.add', { lang: t(other === 'es' ? 'me.spanish' : 'me.english') })}
    </button>}
    {both && !values[other].trim() && <button type="button" className="translate-button" onClick={() => setExpanded(false)}>
      <X />{t('langFields.hide', { lang: t(other === 'es' ? 'me.spanish' : 'me.english') })}
    </button>}
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
