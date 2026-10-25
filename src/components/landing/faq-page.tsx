import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { FAQ_CATEGORIES, FAQ_ITEM_COUNT, type FaqItemDef } from '@/lib/faq';

/**
 * Public FAQ: categorized, searchable, button-based accordions (aria-expanded /
 * aria-controls, keyboard-operable by default). All copy comes from the faqPage
 * locale block; contextual links point only at real routes.
 */
export function FaqPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => FAQ_CATEGORIES.map(cat => ({
    cat,
    items: cat.items.filter(item => !q
      || t(`faqPage.items.${item.id}.q`).toLowerCase().includes(q)
      || t(`faqPage.items.${item.id}.a`).toLowerCase().includes(q)),
  })).filter(g => g.items.length > 0), [q, t]);
  const matchCount = visible.reduce((n, g) => n + g.items.length, 0);

  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  return <LandingFrame>
    <main id="main-content" className="gw-home">
      <section className="gw-hero gw-home-hero" aria-labelledby="faq-h1">
        <div className="gw-container">
          <span className="gw-label">{t('faqPage.eyebrow')}</span>
          <h1 id="faq-h1" className="gw-display gw-hero-h1">{t('faqPage.title')}</h1>
          <p className="gw-lede">{t('faqPage.sub')}</p>
          <div className="gw-faq-search">
            <GwIcon name="Search" size={20} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('faqPage.searchPlaceholder')}
              aria-label={t('faqPage.searchLabel')}
            />
          </div>
          <p className="gw-faq-count" aria-live="polite">{q ? t('faqPage.matches', { count: matchCount }) : t('faqPage.total', { count: FAQ_ITEM_COUNT })}</p>
        </div>
      </section>

      {visible.map(({ cat, items }) => <section key={cat.id} className="gw-home-sec gw-band gw-band-white gw-faq-sec" aria-labelledby={`faq-cat-${cat.id}`}>
        <div className="gw-container">
          <h2 id={`faq-cat-${cat.id}`} className="gw-display gw-h2">{t(`faqPage.categories.${cat.id}`)}</h2>
          <div className="gw-faq-list">
            {items.map(item => <FaqItem key={item.id} item={item} expanded={q.length > 0 || !!open[item.id]} onToggle={() => toggle(item.id)} />)}
          </div>
        </div>
      </section>)}

      {visible.length === 0 && <section className="gw-home-sec gw-band gw-band-white"><div className="gw-container">
        <p className="gw-faq-empty">{t('faqPage.empty')}</p>
      </div></section>}

      <section className="gw-home-sec gw-band gw-band-canvas" aria-labelledby="faq-final">
        <div className="gw-container gw-home-final">
          <h2 id="faq-final" className="gw-display gw-h2">{t('faqPage.finalTitle')}</h2>
          <div className="gw-final-ctas">
            <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary gw-btn-lg">{t('home.cta.createEvent')}<GwIcon name="ArrowRight" size={18} /></Link>
            <a href="/support" className="gw-btn gw-btn-secondary gw-btn-lg">{t('faqPage.linkLabels.support')}</a>
          </div>
        </div>
      </section>
    </main>
  </LandingFrame>;
}

function FaqItem({ item, expanded, onToggle }: { item: FaqItemDef; expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return <div className="gw-faq-item">
    <h3 className="gw-faq-q">
      <button type="button" id={`faq-q-${item.id}`} aria-expanded={expanded} aria-controls={`faq-a-${item.id}`} onClick={onToggle}>
        <span>{t(`faqPage.items.${item.id}.q`)}</span>
        <GwIcon name="ChevronDown" size={20} />
      </button>
    </h3>
    <div id={`faq-a-${item.id}`} role="region" aria-labelledby={`faq-q-${item.id}`} hidden={!expanded} className="gw-faq-a">
      <p>{t(`faqPage.items.${item.id}.a`)}</p>
      {item.links && <p className="gw-faq-links">{item.links.map(l => <a key={l.href} href={l.href} className="gw-textlink">{t(`faqPage.linkLabels.${l.labelKey}`)}<GwIcon name="ArrowRight" size={14} /></a>)}</p>}
    </div>
  </div>;
}
