import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { track } from '@/lib/landing';
import type { Coords } from '@/components/landing/gathering-card';

/** Asks for location only on request, with one calm sentence. Declining offers a ZIP/city field. */
export function LocationFilter({ near, onNear, autoAsk }: { near: Coords | null; onNear: (c: Coords | null) => void; autoAsk?: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'idle' | 'ask' | 'zip' | 'zipSent'>(autoAsk ? 'ask' : 'idle');
  const [zip, setZip] = useState('');
  useEffect(() => { if (autoAsk) setMode('ask'); }, [autoAsk]);

  const allow = () => {
    if (!('geolocation' in navigator)) { setMode('zip'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { track('location_prompt_accept'); onNear({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setMode('idle'); },
      () => { track('location_prompt_decline', { reason: 'denied' }); setMode('zip'); },
      { maximumAge: 10 * 60_000, timeout: 10_000 },
    );
  };
  const decline = () => { track('location_prompt_decline'); setMode('zip'); };
  const submitZip = (e: FormEvent) => { e.preventDefault(); if (zip.trim()) setMode('zipSent'); };

  if (near) return <div className="gw-loc-row"><span className="gw-loc-note"><GwIcon name="MapPin" size={16} />{t('landing.feed.nearYou')}</span><button type="button" className="gw-text-btn" onClick={() => onNear(null)}>{t('landing.feed.clear')}</button></div>;
  if (mode === 'ask') return <div className="gw-loc-panel" role="region" aria-live="polite">
    <p>{t('landing.feed.locationWhy')}</p>
    <div className="gw-loc-actions"><button type="button" className="gw-btn gw-btn-primary gw-btn-sm" onClick={allow}>{t('landing.feed.allow')}</button><button type="button" className="gw-btn gw-btn-secondary gw-btn-sm" onClick={decline}>{t('landing.feed.notNow')}</button></div>
  </div>;
  if (mode === 'zip' || mode === 'zipSent') return <form className="gw-loc-panel" onSubmit={submitZip}>
    <label htmlFor="gw-zip" className="gw-field-label">{t('landing.feed.zipLabel')}</label>
    <div className="gw-loc-actions"><input id="gw-zip" className="gw-input" value={zip} onChange={e => setZip(e.target.value)} placeholder={t('landing.feed.zipPlaceholder')} autoComplete="postal-code" /><button type="submit" className="gw-btn gw-btn-secondary gw-btn-sm">{t('landing.feed.zipApply')}</button></div>
    {mode === 'zipSent' && <p className="gw-loc-note muted" role="status">{t('landing.feed.zipNote')}</p>}
  </form>;
  return <button type="button" className="gw-text-btn gw-loc-trigger" onClick={() => setMode('ask')}><GwIcon name="LocateFixed" size={18} />{t('landing.feed.useLocation')}</button>;
}

export function sortForFeed<T extends { lat: number | null; lng: number | null; going: number; startsAt: Date }>(list: T[], near: Coords | null, dist: (a: Coords, b: Coords) => number) {
  if (!near) return [...list].sort((a, b) => b.going - a.going || a.startsAt.getTime() - b.startsAt.getTime());
  const d = (g: T) => (g.lat != null && g.lng != null ? dist(near, { lat: g.lat, lng: g.lng }) : Number.POSITIVE_INFINITY);
  return [...list].sort((a, b) => d(a) - d(b));
}
