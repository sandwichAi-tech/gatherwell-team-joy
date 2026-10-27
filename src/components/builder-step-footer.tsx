import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Save } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** Focus the first control inside (or matching) an id prefix; returns whether something took focus. */
export function focusField(id: string): boolean {
  const root = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[id^="${CSS.escape(id)}"]`);
  if (!root) return false;
  const target = root.matches('input,textarea,select,button,[tabindex]') ? root : root.querySelector<HTMLElement>('input,textarea,select,button') ?? root;
  target.focus(); target.scrollIntoView?.({ block: 'center' });
  return document.activeElement === target;
}

/**
 * Shared bottom step bar for every resource builder: Back, Save draft and Next on
 * earlier steps; the workflow's real Publish/Update action on the last step.
 * Next is marked unavailable only while the current step has required-field issues,
 * and pressing it then explains why and focuses the first problem instead of doing nothing.
 */
export function BuilderStepFooter({ onBack, onSave, saveDisabled, saving, onNext, blockers, onBlocked, final }: {
  onBack?: (() => void) | undefined; onSave?: (() => void) | undefined; saveDisabled?: boolean; saving?: boolean;
  onNext?: (() => void) | undefined; blockers?: string[]; onBlocked?: (() => boolean) | undefined; final?: ReactNode;
}) {
  const { t } = useTranslation(); const msgId = useId(); const msg = useRef<HTMLParagraphElement>(null);
  const [tried, setTried] = useState(false);
  const blocked = (blockers?.length ?? 0) > 0;
  useEffect(() => { if (!blocked) setTried(false); }, [blocked]);
  const next = () => {
    if (saving) return;
    if (blocked) { setTried(true); requestAnimationFrame(() => { if (!onBlocked?.()) msg.current?.focus(); }); return; }
    onNext?.();
  };
  return <div className="builder-footer" role="group" aria-label={t('builderFooter.label')}>
    {blocked && tried && <p ref={msg} id={msgId} tabIndex={-1} className="builder-footer-alert" role="alert">{t('builderFooter.fixFirst', { fields: blockers!.join(', ') })}</p>}
    <div className="builder-footer-row">
      {onBack && <Button type="button" variant="ghost" disabled={saving} onClick={onBack}><ArrowLeft />{t('resources.item.back')}</Button>}
      {onSave && <Button type="button" variant="secondary" disabled={saveDisabled || saving} aria-busy={saving} onClick={onSave}><Save />{saving ? t('onboarding.saving') : t('gathering.saveDraft')}</Button>}
      {onNext
        ? <Button type="button" className="builder-footer-primary" aria-disabled={blocked || saving} aria-describedby={blocked && tried ? msgId : undefined} data-blocked={blocked} onClick={next}>{t('resources.item.next')}<ArrowRight /></Button>
        : final}
    </div>
  </div>;
}
