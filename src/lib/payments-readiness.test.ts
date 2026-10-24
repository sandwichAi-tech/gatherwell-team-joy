import { describe, expect, it } from 'vitest';
import { readinessSteps, canSellPaid } from './payments-readiness';

describe('readinessSteps', () => {
  it('free offerings are always ready', () => {
    for (const input of [
      { platformConnected: false, connectStatus: 'none' as const },
      { platformConnected: true, connectStatus: 'active' as const },
    ]) {
      expect(readinessSteps(input)[0]).toEqual({ id: 'free', state: 'ready', actor: 'none' });
    }
  });

  it('platform step waits on ZoheeWell when not connected', () => {
    const steps = readinessSteps({ platformConnected: false, connectStatus: 'none' });
    expect(steps[1]).toEqual({ id: 'platform', state: 'waiting', actor: 'zoheewell' });
  });

  it('payout step is a coach action only once the platform is connected', () => {
    expect(readinessSteps({ platformConnected: true, connectStatus: 'none' })[2])
      .toEqual({ id: 'payouts', state: 'action', actor: 'coach' });
    expect(readinessSteps({ platformConnected: true, connectStatus: 'pending' })[2])
      .toEqual({ id: 'payouts', state: 'action', actor: 'coach' });
    // Coach cannot act while the platform side is missing.
    expect(readinessSteps({ platformConnected: false, connectStatus: 'none' })[2])
      .toEqual({ id: 'payouts', state: 'waiting', actor: 'zoheewell' });
  });

  it('everything ready when platform connected and payouts active', () => {
    const steps = readinessSteps({ platformConnected: true, connectStatus: 'active' });
    expect(steps.every(s => s.state === 'ready')).toBe(true);
  });
});

describe('canSellPaid', () => {
  it('requires both platform connection and active payouts', () => {
    expect(canSellPaid({ platformConnected: true, connectStatus: 'active' })).toBe(true);
    expect(canSellPaid({ platformConnected: true, connectStatus: 'pending' })).toBe(false);
    expect(canSellPaid({ platformConnected: false, connectStatus: 'active' })).toBe(false);
    expect(canSellPaid({ platformConnected: false, connectStatus: 'none' })).toBe(false);
  });
});
