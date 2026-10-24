import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { HOME_PLANS, annualPrice } from '@/lib/homepage';

/** Support inbox used across the app for assisted sales and help. */
export const CONTACT_SALES_HREF = 'mailto:help@gatherwell.app';

/** Monthly/annual billing toggle shared by the public pricing cards. */
export function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (a: boolean) => void }) {
  const { t } = useTranslation();
  return <div className="gw-billing-toggle" role="group" aria-label={t('pricingV4.billingPeriod')}>
    <button type="button" className="gw-billing-option" aria-pressed={!annual} onClick={() => onChange(false)}>{t('pricingV4.monthly')}</button>
    <button type="button" className="gw-billing-option" aria-pressed={annual} onClick={() => onChange(true)}>{t('pricingV4.annual')}<span className="gw-billing-save">{t('pricingV4.twoMonthsFree')}</span></button>
  </div>;
}

/**
 * Approved public plan list (2026-10-24 model): per-plan platform-fee ladder and
 * builder seats. Paid checkout is not open yet, so self-serve paid plans say
 * "Setup required"; Organization is assisted setup via Contact sales.
 */
export function ApprovedPlans({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return <div className="gw-v4-pricing">
    <BillingToggle annual={annual} onChange={setAnnual} />
    <ul className="gw-v4-plans">{HOME_PLANS.map(p => <li key={p.id} className="gw-v4-plan">
      <H className="gw-v4-plan-name">{t(`home.pricing.plans.${p.id}`)}</H>
      <p className="gw-v4-plan-desc">{t(`pricingV4.desc.${p.id}`)}</p>
      <p className="gw-home-price tabular">
        {'from' in p && p.from ? <small className="gw-price-from">{t('pricingV4.startingAt')}</small> : null}
        ${annual ? annualPrice(p.monthly) : p.monthly}
        <small>{annual ? t('home.pricing.perYear') : t('home.pricing.perMonth')}</small>
      </p>
      {annual && p.monthly > 0 && <p className="gw-fine">{t('pricingV4.annualSavings', { pct: '16.7' })}</p>}
      <p className="gw-v4-plan-fee">{t('pricingV4.feeLine', { pct: p.feePct })}</p>
      <p className="gw-v4-plan-seats">{t('pricingV4.seatsLine', { n: p.seats })}</p>
      {'contactSales' in p && p.contactSales
        ? <a href={CONTACT_SALES_HREF} className="gw-btn gw-btn-secondary gw-btn-block">{t('pricingV4.contactSales')}</a>
        : p.monthly > 0
          ? <span className="gw-home-tool-tag">{t('pricingV4.setupRequired')}</span>
          : <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary gw-btn-block">{t('home.cta.start')}</Link>}
    </li>)}</ul>
    <p className="gw-fine">{t('pricingV4.checkoutNote')}</p>
  </div>;
}

/** Plain-language builder-seat explainer shown beside the plan cards. */
export function BuilderSeatExplainer() {
  const { t } = useTranslation();
  return <aside className="gw-v4-box gw-seat-explainer" aria-labelledby="seat-title">
    <h2 id="seat-title" className="gw-v4-box-title">{t('pricingV4.seatTitle')}</h2>
    <p>{t('pricingV4.seatBody')}</p>
    <p className="gw-fine">{t('pricingV4.seatFree')}</p>
  </aside>;
}

export function FeeAndFounding() {
  const { t } = useTranslation();
  return <div className="gw-v4-terms">
    <section aria-labelledby="fee-title" className="gw-v4-box">
      <h2 id="fee-title" className="gw-v4-box-title">{t('pricingV4.feeTitle')}</h2>
      <p>{t('pricingV4.feeLadder')}</p>
      <p className="gw-fine">{t('pricingV4.payoutsNote')}</p>
    </section>
    <section aria-labelledby="annual-title" className="gw-v4-box">
      <h2 id="annual-title" className="gw-v4-box-title">{t('pricingV4.annualTitle')}</h2>
      <p>{t('home.pricing.twoMonths')} {t('home.pricing.pilot')}</p>
    </section>
    <section aria-labelledby="founding-title" className="gw-v4-box gw-home-founding">
      <h2 id="founding-title" className="gw-v4-box-title">{t('home.pricing.foundingTitle')}</h2>
      <p>{t('home.pricing.founding')}</p>
    </section>
  </div>;
}

/** One-line approved fee disclosure for every marketing page that shows plans. */
export function FeeDisclosure() {
  const { t } = useTranslation();
  return <p className="gw-fine gw-fee-disclosure">{t('pricingV4.feeDisclosure')}</p>;
}

export function StartHostingLink() {
  const { t } = useTranslation();
  return <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary gw-btn-lg">{t('home.cta.start')}<GwIcon name="ArrowRight" size={18} /></Link>;
}
