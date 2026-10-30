import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { pick } from '@/lib/learn';

export type HostChallenge = { id: string; title_en: string; title_es: string; description_en: string | null; description_es: string | null; starts_on: string; ends_on: string; is_paid: boolean; price_cents: number; currency: string; full: boolean };

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
const fmt = (d: string, lang: string) => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

/** Public challenge cards on a coach page. Only published, customer-open, not-ended challenges reach here (public_host_challenges). */
export function HostChallengeCards({ items, external = false }: { items: HostChallenge[]; external?: boolean }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  if (!items.length) return null;
  return <section className="follow-upcoming" aria-labelledby="host-challenges">
    <h2 id="host-challenges">{t('follow.challenges')}</h2>
    <ul className="follow-list host-challenges">{items.map(c => {
      const title = pick(lang, c.title_en, c.title_es) || t('challenges.builder.untitled');
      const desc = pick(lang, c.description_en ?? '', c.description_es ?? '');
      const price = c.is_paid && c.price_cents ? new Intl.NumberFormat(lang, { style: 'currency', currency: c.currency || 'usd' }).format(c.price_cents / 100) : t('challenges.free');
      const body = <><strong>{title}</strong>{desc && <small className="host-challenge-desc">{desc}</small>}<small>{fmt(c.starts_on, lang)} – {fmt(c.ends_on, lang)} · {t('challenges.days', { count: days(c.starts_on, c.ends_on) })} · {price}</small><span className="host-challenge-cta">{c.full ? t('follow.challengeFull') : t('follow.viewChallenge')}</span></>;
      return <li key={c.id}>{external
        ? <a className="follow-event host-challenge" href={`/c/${c.id}`} target="_blank" rel="noopener">{body}</a>
        : <Link className="follow-event host-challenge" to="/c/$id" params={{ id: c.id }}>{body}</Link>}</li>;
    })}</ul>
  </section>;
}
