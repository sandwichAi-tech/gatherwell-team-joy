import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Share2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    // Fallback for browsers or frames that block the clipboard API.
    const el = document.createElement('textarea'); el.value = text; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    el.remove(); return ok;
  }
}

/** Shows "Copied" with a check for 2 seconds, then returns to its label and can be used again. */
export function CopyButton({ text, label, icon, variant = 'secondary', ...rest }: { text: string; label?: string; icon?: React.ReactNode } & Omit<ComponentProps<typeof Button>, 'onClick' | 'children'>) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onClick = async () => {
    if (!(await copyText(text))) { toast.error(t('error.message')); return; }
    setCopied(true); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  return <Button variant={variant} {...rest} onClick={() => void onClick()} aria-live="polite">
    {copied ? <Check /> : icon ?? <Copy />}{copied ? t('onboarding.copied') : label ?? t('gathering.copyLink')}
  </Button>;
}

/** Opens the phone's share menu; hidden where the browser has none, so the copy button stays the fallback. */
export function ShareButton({ text, url, title, variant = 'secondary', ...rest }: { text?: string; url: string; title?: string } & Omit<ComponentProps<typeof Button>, 'onClick' | 'children'>) {
  const { t } = useTranslation();
  const [can, setCan] = useState(false);
  useEffect(() => { setCan(typeof navigator.share === 'function'); }, []);
  if (!can) return null;
  return <Button variant={variant} {...rest} onClick={() => { void navigator.share({ url, ...(text ? { text } : {}), ...(title ? { title } : {}) }).catch(() => undefined); }}><Share2 />{t('shareKit.share')}</Button>;
}
