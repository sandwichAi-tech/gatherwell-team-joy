import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/launch-states';
import { GwIcon } from '@/components/gw-icon';
import { downloadTextFile } from '@/lib/insights';
import { exportMyData, getConsentHistory } from '@/lib/insights.functions';

const fmtDate = (iso: string | null | undefined, lang: string) => iso ? new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '—';

/** Privacy & data panel: server-authorized self export plus the caller's own consent history. */
export function PrivacyDataPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const exportFn = useServerFn(exportMyData);
  const consentFn = useServerFn(getConsentHistory);
  const [busy, setBusy] = useState(false);
  const { data: consent, isLoading } = useQuery({ queryKey: ['consent-history'], queryFn: () => consentFn() });

  const download = async () => {
    setBusy(true);
    try {
      const data = await exportFn();
      downloadTextFile(`zoheewell-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast.success(t('profile.exported'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const hasConsent = !!consent && (consent.adult_confirmed_at || consent.terms.length > 0 || consent.waivers.length > 0 || consent.guardian_consents.length > 0);

  return <div className="page-stack">
    <section className="panel">
      <div className="section-heading"><h3>{t('profile.exportData')}</h3></div>
      <p className="auth-subtitle">{t('profile.exportDataText')}</p>
      <Button variant="secondary" className="export-btn" disabled={busy} onClick={() => void download()}>
        <GwIcon name="Download" size={16} />{t('profile.exportData')}
      </Button>
    </section>

    <section className="panel">
      <div className="section-heading"><h3>{t('profile.consentHistory')}</h3></div>
      {isLoading ? <ListSkeleton /> : !hasConsent ? <p className="auth-subtitle">{t('profile.consentEmpty')}</p> : (
        <ul className="consent-list">
          {consent!.adult_confirmed_at && <li><GwIcon name="BadgeCheck" size={16} /><span>{t('profile.adultConfirmed')} · {fmtDate(consent!.adult_confirmed_at, lang)}</span></li>}
          {consent!.terms.map((row, i) => <li key={`t${i}`}><GwIcon name="FileText" size={16} /><span>{t('profile.termsAccepted')} · {row.event} · {fmtDate(row.accepted_at, lang)}</span></li>)}
          {consent!.waivers.map((row, i) => <li key={`w${i}`}><GwIcon name="PenLine" size={16} /><span>{t('profile.waivers')} · {row.event}{row.version != null ? ` · ${t('profile.versionLabel')} ${row.version}` : ''} · {fmtDate(row.accepted_at, lang)}</span></li>)}
          {consent!.guardian_consents.map((row, i) => <li key={`g${i}`}><GwIcon name="Baby" size={16} /><span>{t('profile.guardianConsents')} · {row.event}{row.minor_first_name ? ` · ${t('profile.minorLabel')}: ${row.minor_first_name}` : ''} · {fmtDate(row.consented_at, lang)}</span></li>)}
        </ul>
      )}
      {consent?.marketing && <p className="stat-hint">{t('profile.marketingPrefs')}: {consent.marketing.all_off ? t('profile.marketingAllOff') : [consent.marketing.reminders && 'reminders', consent.marketing.announcements && 'announcements', consent.marketing.badges && 'badges', consent.marketing.followups && 'followups'].filter(Boolean).join(', ') || t('profile.marketingAllOff')}</p>}
    </section>
  </div>;
}
