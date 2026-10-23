// Business rules Nick set for payments (October 2026): cancelling keeps paid
// access until the paid period ends, and a failed payment keeps access while
// the provider retries. Only a subscription that is truly over drops the plan.
import { describe, expect, it } from 'vitest';
import { isFinished } from './webhook-events.server';

const UPDATED = 'customer.subscription.updated';
const DELETED = 'customer.subscription.deleted';

describe('subscription access rules', () => {
  it('keeps access when a paid member asks to cancel at month end', () => {
    expect(isFinished(UPDATED, { status: 'active', cancel_at_period_end: true })).toBe(false);
  });

  it('keeps access while a failed payment is still retrying', () => {
    expect(isFinished(UPDATED, { status: 'past_due', cancel_at_period_end: false })).toBe(false);
  });

  it('ends access once the period is actually over', () => {
    expect(isFinished(UPDATED, { status: 'canceled', cancel_at_period_end: false })).toBe(true);
    expect(isFinished(DELETED, { status: 'active', cancel_at_period_end: true })).toBe(true);
  });

  it('ends access when every retry failed', () => {
    expect(isFinished(UPDATED, { status: 'unpaid' })).toBe(true);
    expect(isFinished(UPDATED, { status: 'incomplete_expired' })).toBe(true);
  });
});
