import { useTranslation } from 'react-i18next';

/** Outcome-based guidance, no jargon. */
export function WhichPlan() {
  const { t } = useTranslation();
  const items = t('pricingV4.whichPlan.items', { returnObjects: true }) as { title: string; body: string }[];
  return <section className="gw-band gw-band-canvas gw-marketing-section gw-pricing-guidance" aria-labelledby="which-title">
    <div className="gw-container">
      <h2 id="which-title" className="gw-display gw-h2">{t('pricingV4.whichPlan.title')}</h2>
      <ul className="gw-which-grid">{items.map(i => <li key={i.title} className="gw-v4-box">
        <h3 className="gw-v4-box-title">{i.title}</h3>
        <p>{i.body}</p>
      </li>)}</ul>
    </div>
  </section>;
}
