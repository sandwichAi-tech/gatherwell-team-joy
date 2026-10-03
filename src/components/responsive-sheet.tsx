import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';

/** Bottom sheet on phones, centered dialog on desktop. */
export function ResponsiveSheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const mobile = useIsMobile();
  if (mobile) return <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
    <DrawerContent className="gatherwell-sheet responsive-sheet"><DrawerTitle className="sheet-title">{title}</DrawerTitle>{description ? <DrawerDescription className="sheet-description">{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}<div className="sheet-body">{children}</div></DrawerContent>
  </Drawer>;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="responsive-dialog"><DialogTitle className="sheet-title">{title}</DialogTitle>{description ? <DialogDescription className="sheet-description">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}<div className="sheet-body">{children}</div></DialogContent>
  </Dialog>;
}
