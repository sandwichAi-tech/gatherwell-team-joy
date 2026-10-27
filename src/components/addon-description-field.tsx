import { useTranslation } from 'react-i18next';
import { LangPair } from '@/components/lang-fields';
import { MAX_ADDON_DESCRIPTION, addonDescription, addonDescriptionValid, type Addon } from '@/lib/event-builder';

type Desc = Pick<Addon, 'description_en' | 'description_es'>;

/** Shared optional add-on Description editor (event + challenge), active-language only. */
export function AddonDescriptionField({ id, value, onChange }: { id: string; value: Desc; onChange: (patch: Desc) => void }) {
  const { t } = useTranslation();
  const invalid = !addonDescriptionValid(value);
  return <div className="addon-description-field">
    <LangPair id={id} label={t('addonDescription.label')} multiline rows={2} maxLength={MAX_ADDON_DESCRIPTION}
      en={value.description_en ?? ''} es={value.description_es ?? ''}
      onEn={v => onChange({ description_en: v })} onEs={v => onChange({ description_es: v })} />
    <p className="field-hint" id={`${id}-help`}>{t('addonDescription.help', { max: MAX_ADDON_DESCRIPTION })}</p>
    {invalid && <p className="field-error" role="alert">{t('addonDescription.tooLong', { max: MAX_ADDON_DESCRIPTION })}</p>}
  </div>;
}

/** Customer-facing description; renders nothing when the host left it blank. */
export function AddonDescriptionText({ addon, lang }: { addon: Desc & { description?: string | null | undefined }; lang?: string | undefined }) {
  const text = addonDescription(addon, lang);
  return text ? <p className="addon-description">{text}</p> : null;
}
