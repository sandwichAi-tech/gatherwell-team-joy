import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { HOME_PLANS } from '@/lib/homepage';

/**
 * Accessible plan-comparison chart. Rows cover only real, current capabilities:
 * every built feature is available on every plan today, so those rows say
 * "Included" everywhere rather than inventing paywalls. Provider-dependent items
 * (SMS, payment processing, payouts) are marked honestly as setup/usage based.
 */
type Row =
  | { kind: 'text'; key: string; values: (plan: (typeof HOME_PLANS)[number]) => string }
  | { kind: 'included'; key: string }
  | { kind: 'note'; key: string; note: string };

const ROWS: Row[] = [
  { kind: 'text', key: 'seats', values: p => String(p.seats) },
  { kind: 'text', key: 'fee', values: p => `${p.feePct}%` },
  { kind: 'included', key: 'events' },
  { kind: 'included', key: 'courses' },
  { kind: 'included', key: 'memberships' },
  { kind: 'included', key: 'tickets' },
  { kind: 'included', key: 'checkin' },
  { kind: 'included', key: 'roles' },
  { kind: 'included', key: 'analytics' },
  { kind: 'included', key: 'exports' },
  { kind: 'note', key: 'support', note: 'email' },
  { kind: 'note', key: 'sms', note: 'usage' },
  { kind: 'note', key: 'payments', note: 'setup' },
];

function Cell({ row }: { row: Row }) {
  const { t } = useTranslation();
  if (row.kind === 'included') {
    return <span className="gw-compare-yes"><GwIcon name="Check" size={18} />{t('pricingV4.compare.included')}</span>;
  }
  if (row.kind === 'note') {
    return <span>{t(`pricingV4.compare.note_${row.note}`)}</span>;
  }
  return null;
}

export function PlanComparison() {
  const { t } = useTranslation();
  return <section className="gw-container gw-marketing-section" aria-labelledby="compare-title">
    <h2 id="compare-title" className="gw-display gw-h2">{t('pricingV4.compare.title')}</h2>
    <p className="gw-marketing-sub">{t('pricingV4.compare.sub')}</p>
    <div className="gw-compare-scroll" tabIndex={0} role="region" aria-label={t('pricingV4.compare.title')}>
      <table className="gw-compare-table">
        <caption className="gw-sr-only">{t('pricingV4.compare.caption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="gw-compare-rowhead"><span className="gw-sr-only">{t('pricingV4.compare.feature')}</span></th>
            {HOME_PLANS.map(p => <th key={p.id} scope="col">{t(`home.pricing.plans.${p.id}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => <tr key={row.key}>
            <th scope="row" className="gw-compare-rowhead">{t(`pricingV4.compare.rows.${row.key}`)}</th>
            {HOME_PLANS.map(p => <td key={p.id}>
              {row.kind === 'text' ? <span className="tabular">{row.values(p)}{row.key === 'fee' ? <span className="gw-fine"> {t('pricingV4.compare.onPaidSales')}</span> : null}</span> : <Cell row={row} />}
            </td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
    <p className="gw-fine">{t('pricingV4.compare.footnote')}</p>
  </section>;
}

/** Outcome-based guidance, no jargon. */
export function WhichPlan() {
  const { t } = useTranslation();
  const items = t('pricingV4.whichPlan.items', { returnObjects: true }) as { title: string; body: string }[];
  return <section className="gw-band gw-band-canvas gw-marketing-section" aria-labelledby="which-title">
    <div className="gw-container">
      <h2 id="which-title" className="gw-display gw-h2">{t('pricingV4.whichPlan.title')}</h2>
      <ul className="gw-which-grid">{items.map(i => <li key={i.title} className="gw-v4-box">
        <h3 className="gw-v4-box-title">{i.title}</h3>
        <p>{i.body}</p>
      </li>)}</ul>
    </div>
  </section>;
}
