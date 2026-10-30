import { describe, expect, it } from 'vitest';
import { adjustForRefund, nextRewardStatus, rewardCents } from '@/lib/referrals';

const base = { status: 'pending' as const, kind: 'percent' as const, value: 10, saleCents: 5000, rewardCents: 500 };

describe('referral rewards and refunds', () => {
  it('a $50 sale at 10% earns $5', () => expect(rewardCents('percent', 10, 5000)).toBe(500));
  it('free (zero-value) purchases earn nothing', () => expect(rewardCents('percent', 10, 0)).toBe(0));
  it('a $20 partial refund on a $50 sale at 10% lowers the reward to $3', () => expect(adjustForRefund(base, 2000)).toEqual({ status: 'pending', rewardCents: 300, needsReconcile: false }));
  it('refunding everything reverses the reward', () => expect(adjustForRefund(base, 5000)).toMatchObject({ status: 'reversed', rewardCents: 0 }));
  it('a flat $8 reward drops to what the buyer kept', () => expect(adjustForRefund({ ...base, kind: 'flat', value: 800, rewardCents: 800 }, 4500).rewardCents).toBe(500));
  it('a reward already paid is never changed, only flagged for the host to reconcile', () => expect(adjustForRefund({ ...base, status: 'paid' }, 1000)).toEqual({ status: 'paid', rewardCents: 500, needsReconcile: true }));
  it('failed and cancelled orders reverse unpaid rewards', () => { expect(nextRewardStatus('pending', 'failed')).toBe('reversed'); expect(nextRewardStatus('available', 'cancelled')).toBe('reversed'); });
  it('a full refund after payout leaves the paid status alone', () => expect(nextRewardStatus('paid', 'refunded')).toBe('paid'));
});
