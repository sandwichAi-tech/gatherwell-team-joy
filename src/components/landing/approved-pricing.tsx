import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { HOME_PLANS, PLATFORM_FEE_PERCENT, annualPrice } from '@/lib/homepage';

/** Blueprint v4 public plan list. Paid checkout is not open yet, so paid plans say "Setup required". */
export function ApprovedPlans({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const { t } = useTranslation();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return <div className="gw-v4-pricing">
    <ul className="gw-v4-plans">{HOME_PLANS.map(p => <li key={p.id} className="gw-v4-plan">
      <H className="gw-v4-plan-name">{t(`home.pricing.plans.${p.id}`)}</H>
      <p className="gw-v4-plan-desc">{t(`pricingV4.desc.${p.id}`)}</p>
      <p className="gw-home-price tabular">${p.monthly}<small>{t('home.pricing.perMonth')}</small></p>
      <p className="gw-fine">{p.monthly > 0 ? t('home.pricing.annual', { price: annualPrice(p.monthly) }) : t('pricingV4.freeForever')}</p>
      {p.monthly > 0 && <span className="gw-home-tool-tag">{t('pricingV4.setupRequired')}</span>}
    </li>)}</ul>
    <p className="gw-fine">{t('pricingV4.checkoutNote')}</p>
  </div>;
}

export function FeeAndFounding() {
  const { t } = useTranslation();
  return <div className="gw-v4-terms">
    <section aria-labelledby="fee-title" className="gw-v4-box">
      <h2 id="fee-title" className="gw-v4-box-title">{t('pricingV4.feeTitle')}</h2>
      <p>{t('home.pricing.fee', { pct: PLATFORM_FEE_PERCENT })}</p>
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
  return <p className="gw-fine gw-fee-disclosure">{t('home.pricing.fee', { pct: PLATFORM_FEE_PERCENT })}</p>;
}

export function StartHostingLink() {
  const { t } = useTranslation();
  return <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary gw-btn-lg">{t('home.cta.start')}<GwIcon name="ArrowRight" size={18} /></Link>;
}
