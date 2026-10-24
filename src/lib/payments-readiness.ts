/**
 * Payments readiness rules — client-safe mirror of getPaymentsReadiness.
 * The server function and the block_unpaid_selling trigger are authoritative;
 * this mapper only decides how the checklist renders.
 */

export type ConnectStatus = 'none' | 'pending' | 'active';

export type ReadinessInput = { platformConnected: boolean; connectStatus: ConnectStatus };

export type ReadinessStep = {
  id: 'free' | 'platform' | 'payouts';
  state: 'ready' | 'action' | 'waiting';
  /** Who can move this step: the coach themselves or only ZoheeWell. */
  actor: 'coach' | 'zoheewell' | 'none';
};

/** Free offerings always work; paid selling needs the platform connection first, then coach payout setup. */
export function readinessSteps({ platformConnected, connectStatus }: ReadinessInput): ReadinessStep[] {
  return [
    { id: 'free', state: 'ready', actor: 'none' },
    platformConnected
      ? { id: 'platform', state: 'ready', actor: 'none' }
      : { id: 'platform', state: 'waiting', actor: 'zoheewell' },
    connectStatus === 'active'
      ? { id: 'payouts', state: 'ready', actor: 'none' }
      : platformConnected
        ? { id: 'payouts', state: 'action', actor: 'coach' }
        : { id: 'payouts', state: 'waiting', actor: 'zoheewell' },
  ];
}

/** Paid items can only be published when both sides are ready (mirrors payouts_live + block_unpaid_selling). */
export function canSellPaid(input: ReadinessInput): boolean {
  return input.platformConnected && input.connectStatus === 'active';
}
