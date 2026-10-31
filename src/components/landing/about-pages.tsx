import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon, type GwIconName } from '@/components/gw-icon';
import { LandingFrame } from './landing-chrome';
import { COMPANY, phoneHref } from '@/lib/company';

const ABOUT_WHO_ICONS: GwIconName[] = ['CalendarHeart', 'BookOpen', 'MessageCircle', 'Compass'];
const ABOUT_USE_ICONS: GwIconName[] = ['UsersRound', 'Heart'];

function HostCta({ secondary = false, label }: { secondary?: boolean; label?: string }) {
  const { t } = useTranslation();
  return <Link to="/login" search={{ intent: 'host' }} className={`gw-btn gw-btn-${secondary ? 'secondary' : 'primary'} gw-btn-lg`}>{label ?? t('marketing.hostCta')}<GwIcon name="ArrowRight" size={20} /></Link>;
}

export function AboutPage() {
  const { t } = useTranslation();
  const who = t('marketing.about.who', { returnObjects: true }) as { title: string; body: string }[];
  const uses = t('marketing.about.uses', { returnObjects: true }) as { title: string; body: string }[];
  return <LandingFrame><main id="main-content">
    <section className="gw-hero" aria-labelledby="about-h1">
      <div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav" /><span className="gw-blob gw-blob-peach" /><span className="gw-glow" /></div>
      <div className="gw-container">
        <span className="gw-label">{t('marketing.about.label')}</span>
        <h1 id="about-h1" className="gw-display">{t('marketing.about.title')}</h1>
        <p className="gw-lede">{t('marketing.about.sub')}</p>
        <div className="gw-hero-ctas"><HostCta label={t('marketing.about.ctaHost')} /><Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.about.ctaDiscover')}</Link></div>
      </div>
    </section>
    <section className="gw-band gw-band-white gw-marketing-section" aria-labelledby="about-what">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.about.whatLabel')}</span>
        <h2 id="about-what" className="gw-display gw-h2">{t('marketing.about.whatTitle')}</h2>
        <p className="gw-marketing-sub">{t('marketing.about.whatBody')}</p>
      </div>
    </section>
    <section className="gw-band gw-band-canvas gw-marketing-section" aria-labelledby="about-who">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.about.whoLabel')}</span>
        <h2 id="about-who" className="gw-display gw-h2">{t('marketing.about.whoTitle')}</h2>
        <p className="gw-marketing-sub">{t('marketing.about.whoSub')}</p>
        <div className="gw-benefits-grid">{who.map((w, i) => <article className="gw-benefit-card" key={w.title}><span className="gw-marketing-tile"><GwIcon name={ABOUT_WHO_ICONS[i]!} variant="marketing" size={32} /></span><h3>{w.title}</h3><p>{w.body}</p></article>)}</div>
      </div>
    </section>
    <section className="gw-band gw-band-white gw-marketing-section" aria-labelledby="about-use">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.about.useLabel')}</span>
        <h2 id="about-use" className="gw-display gw-h2">{t('marketing.about.useTitle')}</h2>
        <div className="gw-benefits-grid">{uses.map((u, i) => <article className="gw-benefit-card" key={u.title}><span className="gw-marketing-tile"><GwIcon name={ABOUT_USE_ICONS[i]!} variant="marketing" size={32} /></span><h3>{u.title}</h3><p>{u.body}</p></article>)}</div>
      </div>
    </section>
    <section className="gw-band gw-band-canvas gw-marketing-section" aria-labelledby="about-beta">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.about.betaLabel')}</span>
        <h2 id="about-beta" className="gw-display gw-h2">{t('marketing.about.betaTitle')}</h2>
        <p className="gw-marketing-sub">{t('marketing.about.betaBody')}</p>
      </div>
    </section>
    <section className="gw-band gw-band-white gw-marketing-section" aria-labelledby="about-company">
      <div className="gw-container">
        <h2 id="about-company" className="gw-label">{t('company.blockTitle')}</h2>
        <ul className="gw-company-block">
          <li>{COMPANY.legalName}</li>
          <li>{t('company.formation')}</li>
          <li>{COMPANY.mailingAddress}</li>
          <li><a className="gw-call-link" href={phoneHref}>{t('company.callUs')} {COMPANY.phoneDisplay}</a></li>
          <li><a className="gw-mail-link" href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></li>
        </ul>
      </div>
    </section>
    <section className="gw-band gw-band-canvas gw-marketing-section gw-final-host">
      <div className="gw-container gw-home-final">
        <h2 className="gw-display gw-h2">{t('marketing.about.finalTitle')}</h2>
        <div className="gw-final-ctas"><HostCta label={t('marketing.about.ctaHost')} /><Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.about.ctaDiscover')}</Link></div>
      </div>
    </section>
  </main></LandingFrame>;
}

export function CareersPage() {
  const { t } = useTranslation();
  return <LandingFrame><main id="main-content">
    <section className="gw-hero" aria-labelledby="careers-h1">
      <div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav" /><span className="gw-blob gw-blob-peach" /><span className="gw-glow" /></div>
      <div className="gw-container">
        <span className="gw-label">{t('marketing.careers.label')}</span>
        <h1 id="careers-h1" className="gw-display">{t('marketing.careers.title')}</h1>
        <p className="gw-lede">{t('marketing.careers.sub')}</p>
      </div>
    </section>
    <section className="gw-band gw-band-white gw-marketing-section" aria-labelledby="careers-work">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.careers.workLabel')}</span>
        <h2 id="careers-work" className="gw-display gw-h2">{t('marketing.careers.workTitle')}</h2>
        <p className="gw-marketing-sub">{t('marketing.careers.workBody')}</p>
      </div>
    </section>
    <section className="gw-band gw-band-canvas gw-marketing-section" aria-labelledby="careers-roles">
      <div className="gw-container">
        <span className="gw-label">{t('marketing.careers.rolesLabel')}</span>
        <h2 id="careers-roles" className="gw-display gw-h2">{t('marketing.careers.rolesTitle')}</h2>
        <p className="gw-marketing-sub">{t('marketing.careers.rolesBody')}</p>
        <div className="gw-final-ctas">
          <Link to="/login" search={{ next: '/support' }} className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.careers.contactCta')}<GwIcon name="ArrowRight" size={20} /></Link>
          <Link to="/about" className="gw-btn gw-btn-secondary gw-btn-lg">{t('marketing.careers.aboutCta')}</Link>
        </div>
      </div>
    </section>
  </main></LandingFrame>;
}
