// Resolves (or creates) the payment-provider Customer tied to a signed-in user.
// Putting userId on the Customer object is what makes later reads (portal,
// dashboards, subscription search) work without depending on Session metadata,
// which the provider cannot search.
import type Stripe from 'stripe';

export async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string; userId?: string },
): Promise<string> {
  // userId is interpolated into a search query string below; reject anything
  // that could break out of the quoted value.
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error('Invalid userId');
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}
