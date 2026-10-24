import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { BUILDER_SEATS, formatMoney, formatStorage, PLANS, PRO_FEATURES, yearlyCents, type PlanId } from '@/lib/billing';

type Setting = { monthly_price: number; fee_percent: number } | undefined;

/** Shared tag, price, fee and feature list for the Free / Advanced / Pro cards (public pages and Me > Plan). */
export function PlanCardBody({ id, setting, tagClass, priceClass, feeClass }: { id: PlanId; setting: Setting; tagClass: string; priceClass: string; feeClass: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const lim = PLANS.find(p => p.id === id)!.limits;
  const li = (text: string) => <li key={text}><GwIcon name="Check" size={20} />{text}</li>;
  const n = (v: number) => v.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US');
  return <>
    <span className={tagClass}>{t('billing.tag_' + id)}</span>
    <h3>{t('billing.name_' + id)}</h3>
    <p className={priceClass}><strong>{setting ? formatMoney(setting.monthly_price, lang) : '\u00a0'}</strong><span>{t('billing.perMonth')}</span></p>
    {id === 'growth' && setting && <p className="gw-fine">{t('billing.orYearly', { price: formatMoney(yearlyCents(setting.monthly_price), lang) })}</p>}
    <p className={feeClass}>{!setting ? '\u00a0' : setting.fee_percent > 0 ? t('billing.feeOnSales', { pct: setting.fee_percent }) : t('billing.noPlatformFee')}</p>
    <p className="gw-fine">{t('pricingV4.seatsLine', { n: BUILDER_SEATS[id] })}</p>
    <ul>
      {id === 'free' && <>
        {li(t('billing.fGatherings', { n: lim.gatherings }))}
        {li(t('billing.fGuests', { n: lim.guests }))}
        {li(t('billing.fStorage', { size: formatStorage(lim.storage_mb, lang) }))}
        {li(t('billing.fAssistantHelp', { n: n(lim.assistant) }))}
        {li(t('billing.firstDays'))}
      </>}
      {id === 'growth' && <>
        <li className="gw-plan-features-head plan-features-head">{t('billing.everythingFree')}</li>
        {li(t('billing.fGatheringsUnlimited'))}
        {li(t('billing.fGuests', { n: lim.guests }))}
        {li(t('billing.fStorage', { size: formatStorage(lim.storage_mb, lang) }))}
        {li(t('billing.fAssistant', { n: n(lim.assistant) }))}
      </>}
      {id === 'pro' && <>
        <li className="gw-plan-features-head plan-features-head">{t('billing.everythingAdvanced')}</li>
        {li(t('billing.fGuestsUnlimited'))}
        {li(t('billing.fStorage', { size: formatStorage(lim.storage_mb, lang) }))}
        {li(t('billing.fAssistant', { n: n(lim.assistant) }))}
        {PRO_FEATURES.map(f => li(t('billing.pro_' + f)))}
      </>}
    </ul>
  </>;
}
