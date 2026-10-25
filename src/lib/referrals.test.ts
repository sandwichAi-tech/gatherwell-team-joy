import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { attribute, nextRewardStatus, readRefParam, referralUrl, rewardCents, validateReward, REFERRAL_WINDOW_DAYS, type Click } from '@/lib/referrals';
import { filterArgs, referralErrorKey } from '@/components/referrals';

const day = 86_400_000;
const orderAt = new Date('2026-10-25T12:00:00Z');
const ago = (d: number) => new Date(orderAt.getTime() - d * day);
const none = () => false;

describe('reward validation and calculation', () => {
  it('percent of sale, floored to cents', () => expect(rewardCents('percent', 10, 4999)).toBe(499));
  it('flat amount', () => expect(rewardCents('flat', 500, 4000)).toBe(500));
  it('never exceeds the sale', () => { expect(rewardCents('flat', 9000, 4000)).toBe(4000); expect(rewardCents('percent', 200, 1000)).toBe(900); });
  it('zero sale means zero reward', () => expect(rewardCents('percent', 10, 0)).toBe(0));
  it('rejects percent above 90', () => expect(validateReward('percent', 91, 4000)).toBe('percentTooHigh'));
  it('rejects flat at or above price', () => { expect(validateReward('flat', 4000, 4000)).toBe('flatTooHigh'); expect(validateReward('flat', 3999, 4000)).toBeNull(); });
  it('rejects free items', () => expect(validateReward('percent', 10, 0)).toBe('notPaid'));
  it('rejects zero, negative, fractional', () => { expect(validateReward('percent', 0, 4000)).toBe('invalid'); expect(validateReward('percent', -5, 4000)).toBe('invalid'); expect(validateReward('percent', 2.5, 4000)).toBe('invalid'); });
});

describe('30-day last valid click attribution', () => {
  const clicks: Click[] = [
    { id: 1, referrerId: 'A', userId: 'buyer', at: ago(20) },
    { id: 2, referrerId: 'B', userId: 'buyer', at: ago(3) },
    { id: 3, referrerId: 'C', userId: 'other', at: ago(1) },
  ];
  it('window is 30 days', () => expect(REFERRAL_WINDOW_DAYS).toBe(30));
  it('last click wins', () => expect(attribute({ clicks, buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })?.referrerId).toBe('B'));
  it('clicks older than 30 days do not count', () => expect(attribute({ clicks: [{ id: 9, referrerId: 'A', userId: 'buyer', at: ago(31) }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })).toBeNull());
  it('clicks after the order do not count', () => expect(attribute({ clicks: [{ id: 9, referrerId: 'A', userId: 'buyer', at: new Date(orderAt.getTime() + 1000) }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })).toBeNull());
  it('deterministic tie-break on equal time', () => expect(attribute({ clicks: [{ id: 4, referrerId: 'A', userId: 'buyer', at: ago(2) }, { id: 5, referrerId: 'B', userId: 'buyer', at: ago(2) }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })?.id).toBe(5));
  it('anonymous clicks count only once claimed to the buyer (signup/login persistence)', () => {
    const anon: Click = { id: 7, referrerId: 'A', userId: null, at: ago(2) };
    expect(attribute({ clicks: [anon], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })).toBeNull();
    expect(attribute({ clicks: [{ ...anon, userId: 'buyer' }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })?.referrerId).toBe('A');
  });
  it('self-referral refused, falls back to earlier valid click', () => expect(attribute({ clicks: [...clicks, { id: 8, referrerId: 'buyer', userId: 'buyer', at: ago(1) }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })?.referrerId).toBe('B'));
  it('host cannot earn on own item', () => expect(attribute({ clicks: [{ id: 1, referrerId: 'H', userId: 'buyer', at: ago(1) }], buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: none })).toBeNull());
  it('same-team referrer refused', () => expect(attribute({ clicks, buyerId: 'buyer', hostId: 'H', orderAt, sharesTeam: (a) => a === 'B' })?.referrerId).toBe('A'));
});

describe('refund reversal', () => {
  it('refund reverses pending and available', () => { expect(nextRewardStatus('pending', 'refunded')).toBe('reversed'); expect(nextRewardStatus('available', 'cancelled')).toBe('reversed'); expect(nextRewardStatus('available', 'disputed')).toBe('reversed'); });
  it('recorded payouts are not silently rewritten', () => expect(nextRewardStatus('paid', 'refunded')).toBe('paid'));
  it('paid order does not change status', () => expect(nextRewardStatus('pending', 'paid')).toBe('pending'));
});

describe('links, filters and errors', () => {
  it('builds canonical links with rc param', () => { expect(referralUrl('https://zoheewell.com', 'event', 'e1', 'ABCDEFGH')).toBe('https://zoheewell.com/e/e1?rc=ABCDEFGH'); expect(referralUrl('https://x', 'offer', 'o1', 'ABCDEFGH')).toBe('https://x/o/o1?rc=ABCDEFGH'); });
  it('accepts only valid codes', () => { expect(readRefParam('abcdefgh')).toBe('ABCDEFGH'); expect(readRefParam('ABC')).toBeNull(); expect(readRefParam('ABCDEFG1')).toBeNull(); expect(readRefParam(null)).toBeNull(); });
  it('empty filters mean all', () => expect(filterArgs({ program: '', referrer: '', status: '', from: '', to: '' })).toEqual({}));
  it('passes filters through', () => expect(filterArgs({ program: 'p', referrer: 'r', status: 'paid', from: '2026-10-01', to: '2026-10-31' })._status).toBe('paid'));
  it('maps server errors', () => { expect(referralErrorKey('referral_flat_too_high')).toBe('referral.errors.flat_too_high'); expect(referralErrorKey('boom')).toBe('referral.errors.generic'); });
});

describe('EN/ES copy', () => {
  const keys = (o: unknown, p = ''): string[] => typeof o === 'object' && o ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];
  it('every referral key exists in both languages', () => expect(keys(es.referral).sort()).toEqual(keys(en.referral).sort()));
  it('payout copy never claims ZoheeWell sent money', () => {
    expect(en.referral.payout.manualOnly).toMatch(/No money moves/);
    expect(es.referral.payout.manualOnly).toMatch(/no se mueve dinero/);
    expect(en.referral.payout.confirm).toMatch(/outside ZoheeWell/);
  });
});
