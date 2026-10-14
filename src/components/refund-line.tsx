import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { Label } from '@/components/ui/label';
import { asRefundPolicy, REFUND_POLICIES, type RefundPolicy } from '@/lib/refunds';

/** The host's refund rule, shown under every paid price. */
export function RefundLine({ policy }: { policy: unknown }) {
  const { t } = useTranslation();
  return <p className="field-hint refund-line"><GwIcon name="ShieldCheck" size={16} /><span>{t(`refunds.${asRefundPolicy(policy)}`)} · {t('refunds.hostCancels')}</span></p>;
}

export function RefundSelect({ id, value, onChange }: { id: string; value: RefundPolicy; onChange: (v: RefundPolicy) => void }) {
  const { t } = useTranslation();
  return <div className="form-field">
    <Label htmlFor={id} className="field-label">{t('refunds.label')}</Label>
    <select id={id} className="field-input" value={value} onChange={e => onChange(asRefundPolicy(e.target.value))}>
      {REFUND_POLICIES.map(p => <option key={p} value={p}>{t(`refunds.${p}`)}</option>)}
    </select>
    <small className="field-hint">{t('refunds.hostCancels')}</small>
  </div>;
}
