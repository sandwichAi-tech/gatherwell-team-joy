import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { publicEventAddons, eventAddonImages } from '@/lib/addon-images.functions';
import { inviteToken } from '@/lib/guest';
import { ADDON_IMAGE_RATIO } from '@/lib/addon-images';
import { BrandImage } from '@/components/brand-image';
import { AddonDescriptionText } from '@/components/addon-description-field';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/billing';

/** Existing add-ons are preview-only: this does not introduce selection or change checkout totals. */
export function EventAddons({ eventId, authenticated = false }: { eventId: string; authenticated?: boolean }) {
  const { t, i18n } = useTranslation(); const publicRead = useServerFn(publicEventAddons); const signedRead = useServerFn(eventAddonImages);
  const { data = [], isPending, error, refetch } = useQuery({ queryKey: ['event-addons', eventId, authenticated, inviteToken()], queryFn: () => authenticated ? signedRead({ data: { id: eventId } }) : publicRead({ data: { id: eventId, token: inviteToken() } }), staleTime: 5 * 60_000 });
  if (isPending) return <p className="field-hint" role="status">{t('addonImages.loading')}</p>;
  if (error) return <p className="field-error" role="alert">{t('addonImages.loadError')} <Button variant="ghost" onClick={() => void refetch()}>{t('common.retry')}</Button></p>;
  if (!data.length) return null;
  return <section className="event-addons" aria-label={t('addonImages.title')}><h2>{t('addonImages.title')}</h2><ul>
    {data.map(a => <li key={a.id}>
      {a.image && <BrandImage src={a.image} alt={t('addonImages.alt', { name: a.name })} aspect={ADDON_IMAGE_RATIO} className="addon-image" sizes="(max-width: 600px) 100vw, 240px" />}
      <div><strong>{a.name}</strong><AddonDescriptionText addon={a} lang={i18n.resolvedLanguage} /><p>{formatMoney(a.price_cents, i18n.resolvedLanguage === 'es' ? 'es' : 'en')}</p></div>
    </li>)}
  </ul></section>;
}