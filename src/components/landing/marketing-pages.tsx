import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon, type GwIconName } from '@/components/gw-icon';
import { LandingFrame, StickyFindBar } from './landing-chrome';
import { PlanCardBody } from '@/components/plan-features';
import { paymentsStatusQuery, PLANS, PRO_FEATURES, LICENSES, formatMoney, formatStorage, planSettingsQuery } from '@/lib/billing';
import { useQuery } from '@tanstack/react-query';

const BENEFIT_ICONS: GwIconName[] = ['CalendarPlus', 'Link2', 'BellRing', 'QrCode', 'BookOpen', 'UsersRound'];
const STEP_ICONS: GwIconName[] = ['CalendarPlus', 'Share2', 'QrCode', 'MessageCircle'];
function StartLink({ secondary = false, label }: { secondary?: boolean; label?: string }) {
 const { t } = useTranslation();
 return <Link to="/login" search={{ intent: 'host' }} className={`gw-btn gw-btn-${secondary ? 'secondary' : 'primary'} gw-btn-lg`}>{label ?? t('marketing.hostCta')}<GwIcon name="ArrowRight" size={20} /></Link>;
}
function Faq({ kind }: { kind: 'hostFaq' | 'pricingFaq' }) {
 const { t, i18n } = useTranslation();
 const { data: settings } = useQuery(planSettingsQuery);
 const free = settings?.free; const pro = settings?.pro;
 const money = (n: number) => formatMoney(n, i18n.resolvedLanguage ?? 'en');
 const vars = kind === 'pricingFaq' && free && pro ? {
  fee: `${free.fee_percent}%`,
  cap: free.monthly_cap != null ? money(free.monthly_cap) : '',
  pro: money(pro.monthly_price),
 } : undefined;
 const items = t(`marketing.${kind}`, { returnObjects: true, ...vars }) as { q: string; a: string; note?: string }[];
 return <section className="gw-band gw-band-white gw-marketing-section"><div className="gw-container gw-faq"><h2 className="gw-display gw-h2">{t('marketing.faqTitle')}</h2><div>{items.map(item => <details key={item.q}><summary>{item.q}<GwIcon name="ChevronDown" size={20} /></summary><p>{item.a}{item.note ? <span hidden>{item.note}</span> : null}</p></details>)}</div></div></section>;
}
export function WhatYouPay() {
 const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
 const { data: settings } = useQuery(planSettingsQuery);
 const money = (n: number) => formatMoney(n, lang);
 const rows: { label: string; value: (id: (typeof PLANS)[number]['id']) => string }[] = [
  { label: t('marketing.payTable.monthly'), value: id => settings ? money(settings[id].monthly_price) : '—' },
  { label: t('marketing.payTable.platformFee'), value: id => settings ? `${settings[id].fee_percent}%` : '—' },
  { label: t('marketing.payTable.serviceFee'), value: id => settings ? `${settings[id].service_fee_percent}% + ${money(settings[id].service_fee_fixed)}` : '—' },
  { label: t('marketing.payTable.whoPays'), value: () => t('marketing.payTable.whoPaysValue') },
  { label: t('marketing.payTable.gatherings'), value: id => id === 'free' ? t('marketing.payTable.gatheringsFree', { n: PLANS[0]!.limits.gatherings }) : t('marketing.payTable.unlimited') },
  { label: t('marketing.payTable.guests'), value: id => { const g = PLANS.find(p => p.id === id)!.limits.guests; return id === 'free' ? t('marketing.payTable.guestsFree', { n: g }) : g == null ? t('marketing.payTable.unlimited') : String(g); } },
 ];
 return <section className="gw-band gw-band-canvas gw-marketing-section"><div className="gw-container">
  <span className="gw-label">{t('marketing.pricingLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.payTable.title')}</h2><p className="gw-marketing-sub">{t('marketing.payTable.sub')}</p>
  <table className="gw-pay-table"><thead><tr><th scope="col"><span className="gw-sr-only">{t('marketing.payTable.title')}</span></th>{PLANS.map(p => <th key={p.id} scope="col">{t('billing.name_' + p.id)}</th>)}</tr></thead>
   <tbody>{rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th>{PLANS.map(p => <td key={p.id}>{r.value(p.id)}</td>)}</tr>)}</tbody></table>
  <div className="gw-pay-cards">{PLANS.map(p => <article key={p.id} className="gw-pay-card"><h3>{t('billing.name_' + p.id)}</h3><dl>{rows.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{r.value(p.id)}</dd></div>)}</dl></article>)}</div>
 </div></section>;
}
export function PricingCards({ preview = false }: { preview?: boolean }) {
 const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
 const { data: settings } = useQuery(planSettingsQuery);
 const { data: pay } = useQuery(paymentsStatusQuery);
 const license = LICENSES[0]!;
 return <div className="gw-pricing-content">
  <div className="gw-public-plans">
   {PLANS.map(plan => <article key={plan.id} className={"gw-public-plan"}>
    <PlanCardBody id={plan.id} setting={settings?.[plan.id]} tagClass="gw-plan-tag" priceClass="gw-public-price" feeClass="gw-plan-fee"/>
    {plan.id !== 'free' && !pay?.connected ? <span className="gw-btn gw-btn-secondary gw-btn-block" aria-disabled="true">{t('billing.comingSoon')}</span> : <Link to="/login" search={{intent:'host'}} className={`gw-btn gw-btn-${plan.id==='pro' ? 'primary' : 'secondary'} gw-btn-block`}>{t('marketing.choose',{plan:t('billing.name_'+plan.id)})}</Link>}
   </article>)}
   <article className="gw-public-plan"><span className="gw-plan-tag">{t('marketing.leaderLabel')}</span><h3>{t('billing.name_team')}</h3><p className="gw-public-price"><strong>{t('marketing.from',{price:formatMoney(license.cents,lang)})}</strong><span>{t('billing.perMonth')}</span></p><ul><li><GwIcon name="Check" size={20}/>{t('billing.seatsGrowth',{n:license.seats})}</li><li><GwIcon name="Check" size={20}/>{t('marketing.leaderFeatures.0')}</li><li><GwIcon name="Check" size={20}/>{t('marketing.leaderFeatures.1')}</li><li><GwIcon name="Check" size={20}/>{t('marketing.leaderFeatures.2')}</li></ul><p className="gw-fine">{t('marketing.licenseDetail',{small:formatMoney(license.cents,lang),large:formatMoney(LICENSES[1]!.cents,lang)})}</p><Link to="/login" search={{intent:'host'}} className="gw-btn gw-btn-secondary gw-btn-block">{t('marketing.hostCta')}</Link></article>
  </div>
  <p className="gw-fine">{t('billing.cardNote')}</p>
  {!preview && <p className="gw-fine">{t('marketing.licenseNote')}</p>}
 </div>;
}
export function HostsPage() {
 const {t}=useTranslation();const { data: pay } = useQuery(paymentsStatusQuery);const benefits=t('marketing.benefits',{returnObjects:true}) as {title:string;body:string;demo:string;sells?:boolean}[];const steps=t('marketing.hostSteps',{returnObjects:true}) as {title:string;body:string}[];
 return <LandingFrame><main id="main-content"><section className="gw-hero gw-hosts-hero" id="hosts-hero"><div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav"/><span className="gw-blob gw-blob-peach"/><span className="gw-glow"/></div><div className="gw-container gw-hosts-hero-grid"><div><span className="gw-label">{t('marketing.hostsLabel')}</span><h1 className="gw-display">{t('marketing.hostsTitle')}</h1><p className="gw-lede">{t('marketing.hostsSub')}</p><div className="gw-hero-ctas"><StartLink/><Link to="/pricing" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.seePricing')}</Link></div><Link to="/studios" className="gw-see-all gw-hosts-studio-link">{t('marketing.studios.fromHosts')}<GwIcon name="ArrowRight" size={20} /></Link></div><div className="gw-host-demo"><span className="chip sample-badge">{t('landing.card.sample')}</span><div className="gw-host-demo-cover"><GwIcon name="PersonSimpleTaiChi" variant="marketing" size={64}/></div><h2>{t('marketing.benefits.0.demo')}</h2><div className="gw-host-demo-row"><GwIcon name="CalendarCheck" variant="marketing" size={24}/><span>{t('marketing.hostSteps.0.body')}</span></div><div className="gw-host-demo-row"><GwIcon name="UsersRound" variant="marketing" size={24}/><span>{t('marketing.benefits.1.demo')}</span></div><div className="gw-host-demo-row"><GwIcon name="CheckCircle2" variant="marketing" size={24}/><span>{t('marketing.benefits.3.demo')}</span></div></div></div></section>
 <section className="gw-band gw-band-white gw-marketing-section"><div className="gw-container"><span className="gw-label">{t('marketing.hostsLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.benefitTitle')}</h2><p className="gw-marketing-sub">{t('marketing.benefitSub')}</p><div className="gw-benefits-grid">{benefits.map((b,i)=><article className="gw-benefit-card" key={b.title}><span className="gw-marketing-tile"><GwIcon name={BENEFIT_ICONS[i]!} variant="marketing" size={32}/></span><h3>{b.title}</h3>{b.sells && !pay?.connected && <span className="gw-plan-tag">{t('billing.comingSoon')}</span>}<p>{b.body}</p><div className="gw-benefit-demo"><GwIcon name={BENEFIT_ICONS[i]!} variant="marketing" size={20}/><strong>{b.demo}</strong></div></article>)}</div></div></section>
 <WhoItsFor/>
 <section className="gw-band gw-band-canvas gw-marketing-section"><div className="gw-container"><span className="gw-label">{t('marketing.howHostSub')}</span><h2 className="gw-display gw-h2">{t('marketing.howHostTitle')}</h2><ol className="gw-host-steps">{steps.map((s,i)=><li key={s.title}><span className="gw-marketing-tile"><GwIcon name={STEP_ICONS[i]!} variant="marketing" size={32}/></span><span className="gw-how-num">{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3><p>{s.body}</p></li>)}</ol></div></section>
 <section className="gw-host-band gw-leader-marketing"><div className="gw-container"><span className="gw-label on-dark">{t('marketing.leaderLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.leaderTitle')}</h2><p>{t('marketing.leaderBody')}</p><div className="gw-leader-pills">{(t('marketing.leaderFeatures',{returnObjects:true}) as string[]).map(f=><span key={f}><GwIcon name="Check" size={20}/>{f}</span>)}</div><StartLink secondary/></div></section>
 <section className="gw-band gw-band-white gw-marketing-section"><div className="gw-container"><span className="gw-label">{t('marketing.pricingLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.pricingTitle')}</h2><PricingCards preview/><Link to="/pricing" className="gw-see-all">{t('marketing.seePricing')}<GwIcon name="ArrowRight" size={20}/></Link></div></section><Faq kind="hostFaq"/><section className="gw-band gw-band-canvas gw-marketing-section gw-final-host"><div className="gw-container"><h2 className="gw-display gw-h2">{t('marketing.finalTitle')}</h2><p>{t('marketing.finalBody')}</p><StartLink/></div></section></main><StickyFindBar heroId="hosts-hero" mode="host"/></LandingFrame>;
}
export function PricingPage(){const {t}=useTranslation();return <LandingFrame><main id="main-content"><section className="gw-hero gw-pricing-hero"><div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav"/><span className="gw-blob gw-blob-peach"/></div><div className="gw-container"><span className="gw-label">{t('marketing.pricingLabel')}</span><h1 className="gw-display">{t('marketing.pricingTitle')}</h1><p className="gw-lede">{t('marketing.pricingSub')}</p></div></section><section className="gw-container gw-marketing-section"><PricingCards/></section><WhatYouPay/><Faq kind="pricingFaq"/><section className="gw-band gw-band-canvas gw-marketing-section gw-final-host"><div className="gw-container"><h2 className="gw-display gw-h2">{t('marketing.finalTitle')}</h2><StartLink/></div></section></main></LandingFrame>;}
const WHO_ICONS: GwIconName[] = ['Sparkles', 'Clock', 'HandHeart', 'Trophy', 'Home', 'GraduationCap'];
export function WhoItsFor() {
 const { t } = useTranslation(); const items = t('marketing.who', { returnObjects: true }) as { title: string; body: string }[];
 return <section className="gw-band gw-band-canvas gw-marketing-section" aria-labelledby="who-title"><div className="gw-container"><span className="gw-label">{t('marketing.whoLabel')}</span><h2 id="who-title" className="gw-display gw-h2">{t('marketing.whoTitle')}</h2><p className="gw-marketing-sub">{t('marketing.whoSub')}</p><ul className="gw-benefits-grid gw-who-grid">{items.map((w, i) => <li className="gw-benefit-card" key={w.title}><span className="gw-marketing-tile"><GwIcon name={WHO_ICONS[i]!} variant="marketing" size={32} /></span><h3>{w.title}</h3><p>{w.body}</p></li>)}</ul></div></section>;
}
const STUDIO_ICONS: GwIconName[] = ['Link2', 'UsersRound', 'Languages'];
function StudiosPricing() {
 const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
 const { data: settings } = useQuery(planSettingsQuery);
 return <div className="gw-pricing-content">
  <div className="gw-public-plans">
   {PLANS.map(plan => <article key={plan.id} className={"gw-public-plan"}>
    <PlanCardBody id={plan.id} setting={settings?.[plan.id]} tagClass="gw-plan-tag" priceClass="gw-public-price" feeClass="gw-plan-fee"/>
    <p className="gw-fine">{t('billing.cardNote')}</p>
   </article>)}
  </div>
  <div className="gw-final-ctas"><StartLink label={t('marketing.studios.startCta')} /><Link to="/pricing" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.seePricing')}</Link></div>
 </div>;
}
export function StudiosPage() {
 const { t } = useTranslation();
 const cards = t('marketing.studios.cards', { returnObjects: true }) as { title: string; body: string }[];
 const simple = t('marketing.studios.simpleList', { returnObjects: true }) as string[];
 return <LandingFrame><main id="main-content">
  <section className="gw-hero gw-studios-hero" id="studios-hero"><div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav" /><span className="gw-blob gw-blob-peach" /><span className="gw-glow" /></div><div className="gw-container"><span className="gw-label">{t('marketing.studios.label')}</span><h1 className="gw-display">{t('marketing.studios.title')}</h1><p className="gw-lede">{t('marketing.studios.sub')}</p><div className="gw-hero-ctas"><StartLink /><Link to="/pricing" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.seePricing')}</Link></div></div></section>
  <section className="gw-band gw-band-white gw-marketing-section"><div className="gw-container"><div className="gw-benefits-grid">{cards.map((c, i) => <article className="gw-benefit-card" key={c.title}><span className="gw-marketing-tile"><GwIcon name={STUDIO_ICONS[i]!} variant="marketing" size={32} /></span><h3>{c.title}</h3><p>{c.body}</p></article>)}</div></div></section>
  <section className="gw-band gw-band-canvas gw-marketing-section"><div className="gw-container"><span className="gw-label">{t('marketing.studios.simpleLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.studios.simpleTitle')}</h2><p className="gw-marketing-sub">{t('marketing.studios.simpleBody')}</p><ul className="gw-simple-list">{simple.map(s => <li key={s}><GwIcon name="Check" size={20} />{s}</li>)}</ul></div></section>
  <section className="gw-band gw-band-white gw-marketing-section gw-final-host"><div className="gw-container"><span className="gw-label">{t('marketing.pricingLabel')}</span><h2 className="gw-display gw-h2">{t('marketing.studios.pricingTitle')}</h2><StudiosPricing /></div></section>
 </main><StickyFindBar heroId="studios-hero" mode="host" /></LandingFrame>;
}
