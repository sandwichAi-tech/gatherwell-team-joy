// Browser-side payment bootstrap. The environment is read from the token
// prefix so a build that shipped before go-live fails loudly on the page
// instead of routing a customer to a live checkout that cannot work.
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Declared locally (duplicated with the server utility) so this client module
// has no cross-tree imports. Structurally identical to the server StripeEnv.
export type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith('pk_test_')) return 'sandbox';
  if (clientToken?.startsWith('pk_live_')) return 'live';
  throw new Error(
    'Payments are not configured for this build. ' +
      'Complete go-live in your Lovable project to accept real payments.',
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function paymentsTokenPresent(): boolean {
  return typeof clientToken === 'string' && /^(pk_test_|pk_live_)/.test(clientToken);
}
