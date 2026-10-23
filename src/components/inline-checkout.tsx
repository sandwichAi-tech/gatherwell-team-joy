// Inline payment form: the provider's own PCI-compliant checkout mounted on the
// page, so nobody leaves the app to pay. The client secret is captured once when
// the sheet opens — handing the form a new secret later is what breaks it.
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe';
import { ResponsiveSheet } from '@/components/responsive-sheet';

type Pending = { fetchClientSecret: () => Promise<string> };

export function useInlineCheckout() {
  const [pending, setPending] = useState<Pending | null>(null);
  const openCheckout = useCallback((fetchClientSecret: () => Promise<string>) => {
    setPending({ fetchClientSecret });
  }, []);
  const closeCheckout = useCallback(() => setPending(null), []);
  // Rendered element, not a component factory: a new component reference on each
  // render would remount the provider and kill the form.
  const element = pending
    ? <CheckoutSheet onClose={closeCheckout} fetchClientSecret={pending.fetchClientSecret} />
    : null;
  return { openCheckout, closeCheckout, element };
}

function CheckoutSheet({ onClose, fetchClientSecret }: { onClose: () => void; fetchClientSecret: () => Promise<string> }) {
  const { t } = useTranslation();
  return (
    <ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} title={t('billing.checkoutTitle')}>
      <div className="gw-inline-checkout">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </ResponsiveSheet>
  );
}
