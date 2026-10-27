import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** Challenges always edit just the active language, preserving the inactive value in parent state. */
export function ChallengeLanguageField({ id, label, en, es, onEn, onEs, multiline = false, maxLength = 120 }: { id: string; label: string; en: string; es: string; onEn: (v: string) => void; onEs: (v: string) => void; multiline?: boolean; maxLength?: number }) {
  const { i18n } = useTranslation();
  const spanish = i18n.resolvedLanguage === 'es';
  const props = { id, value: spanish ? es : en, maxLength, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (spanish ? onEs : onEn)(e.target.value), className: multiline ? 'field-textarea' : 'field-input' };
  return <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{multiline ? <Textarea rows={3} {...props} /> : <Input {...props} />}</div>;
}