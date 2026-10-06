import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { GwFeatureTile, type GwIconName } from '@/components/gw-icon';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; icon?: GwIconName; footer?: ReactNode; children: ReactNode };

/** Bottom sheet on phones (grab handle, drag to dismiss), centered dialog on desktop. Optional icon tile and sticky footer. */
export function ResponsiveSheet({ open, onOpenChange, title, description, icon, footer, children }: Props) {
  const mobile = useIsMobile();
  const head = (T: typeof DialogTitle | typeof DrawerTitle, D: typeof DialogDescription | typeof DrawerDescription) => <div className={`sheet-head ${icon ? 'has-icon' : ''}`}>
    {icon && <GwFeatureTile name={icon} size={24} />}
    <div><T className="sheet-title">{title}</T>{description ? <D className="sheet-description">{description}</D> : <D className="sr-only">{title}</D>}</div>
  </div>;
  const foot = footer ? <div className="sheet-footer">{footer}</div> : null;
  if (mobile) return <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
    <DrawerContent className="gatherwell-sheet responsive-sheet">{head(DrawerTitle, DrawerDescription)}<div className="sheet-body">{children}</div>{foot}</DrawerContent>
  </Drawer>;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="responsive-dialog">{head(DialogTitle, DialogDescription)}<div className="sheet-body">{children}</div>{foot}</DialogContent>
  </Dialog>;
}
