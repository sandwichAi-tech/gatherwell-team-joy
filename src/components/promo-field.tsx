import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCode, promoErrorKey, type Promo, type PromoCheck } from '@/lib/promo';
import { formatMoney } from '@/lib/billing';

/** "Have a code?" field used at every checkout. Validates with the host's rules before paying. */
export function PromoField({ kind, target, buyer = '', discountCents, value, onChange }: { kind: 'gathering' | 'challenge' | 'offer'; target: string; buyer?: string; discountCents: number; value: Promo | null; onChange: (p: Promo | null) => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [open, setOpen] = useState(false); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const apply = async () => {
    const c = normalizeCode(code); if (!c) return;
    setBusy(true); setError(null);
    const { data } = await supabase.rpc('check_promo', { _code: c, _kind: kind, _target: target, _buyer: buyer });
    setBusy(false);
    const r = (data as PromoCheck | null) ?? { ok: false, error: 'invalid' };
    if (r.ok) { onChange({ id: r.id, code: r.code, kind: r.kind, amount: r.amount }); setCode(''); } else setError(t(promoErrorKey(r.error)));
  };
  if (value) return <p className="promo-applied" role="status"><Check /><span><strong>{value.code}</strong> · {t('promo.saved', { amount: formatMoney(discountCents, lang) })}</span>
    <Button type="button" variant="ghost" size="icon" aria-label={t('promo.remove')} onClick={() => onChange(null)}><X /></Button></p>;
  if (!open) return <button type="button" className="text-link promo-toggle" onClick={() => setOpen(true)}>{t('promo.haveCode')}</button>;
  return <div className="promo-field">
    <label className="field-label" htmlFor={`promo-${target}`}>{t('promo.code')}</label>
    <div className="promo-row">
      <Input id={`promo-${target}`} className="field-input" autoCapitalize="characters" autoComplete="off" maxLength={24} value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void apply(); } }} />
      <Button type="button" variant="secondary" disabled={busy || !normalizeCode(code)} onClick={() => void apply()}>{busy ? t('promo.checking') : t('promo.apply')}</Button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
