import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GwIcon } from '@/components/gw-icon';
import { setViewAsUser } from '@/lib/feature-flags';

/** Shown to admins while "View as a regular user" hides their access to switched-off features. */
export function ViewAsUserBanner() {
  const { t } = useTranslation();
  return <div className="view-as-banner" role="status">
    <GwIcon name="Eye" size={18} />
    <span>{t('viewAsUser.banner')}</span>
    <Button type="button" variant="ghost" size="sm" onClick={() => setViewAsUser(false)}>{t('viewAsUser.stop')}</Button>
  </div>;
}
