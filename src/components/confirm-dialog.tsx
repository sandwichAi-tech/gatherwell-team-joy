import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GwIcon } from '@/components/gw-icon';

type ConfirmOptions = { title: string; body?: string; confirmLabel?: string; destructive?: boolean };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let push: ((p: Pending) => void) | null = null;
const queue: Pending[] = [];
let active = false;
const advance = () => {
  if (!push || active) return;
  const next = queue.shift();
  if (next) { active = true; push(next); }
};

/** Premium replacement for window.confirm. Resolves true when confirmed. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (!push) { resolve(false); return; }
    queue.push({ ...opts, resolve });
    advance();
  });
}

/** Mount once near the root. */
export function ConfirmHost() {
  const { t } = useTranslation();
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => {
    push = setP;
    return () => { push = null; active = false; queue.splice(0).forEach(item => item.resolve(false)); };
  }, []);
  const done = (ok: boolean) => { p?.resolve(ok); setP(null); active = false; queueMicrotask(advance); };
  return <AlertDialog open={!!p} onOpenChange={o => { if (!o) done(false); }}>
    <AlertDialogContent className="gw-confirm">
      {p && <>
        <AlertDialogHeader className="gw-confirm-head">
          <span className={`gw-confirm-tile ${p.destructive ? 'is-danger' : ''}`} aria-hidden="true"><GwIcon name={p.destructive ? 'Trash2' : 'AlertCircle'} size={24} /></span>
          <AlertDialogTitle>{p.title}</AlertDialogTitle>
          {p.body ? <AlertDialogDescription>{p.body}</AlertDialogDescription> : <AlertDialogDescription className="sr-only">{p.title}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gw-confirm-actions">
          <AlertDialogCancel onClick={() => done(false)}>{t('confirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction className={p.destructive ? 'gw-confirm-danger' : ''} onClick={() => done(true)}>{p.confirmLabel ?? (p.destructive ? t('confirm.delete') : t('confirm.ok'))}</AlertDialogAction>
        </AlertDialogFooter>
      </>}
    </AlertDialogContent>
  </AlertDialog>;
}
