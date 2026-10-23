// Renders nothing with a live token. When the token is missing (a build shipped
// before go-live finished) it tells the customer checkout is not open yet.
const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="gw-pay-banner gw-pay-banner--off" role="status">
        Checkout is not open yet. Complete payments go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith('pk_test_')) {
    return (
      <div className="gw-pay-banner gw-pay-banner--test" role="status">
        Purchases here are in test mode — no real money moves.{' '}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more
        </a>
      </div>
    );
  }
  return null;
}
