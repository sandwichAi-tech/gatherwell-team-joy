/** Challenges stay blocked until the existing order, inventory and refund lifecycle is verified. */
export const challengeCheckoutReadiness = () => ({ ok: false as const, error: 'not_connected' });

export function confirmedChallengePayment(session: { payment_status?: string; payment_intent?: unknown; amount_total?: number | null }, payment: { stripe_session_id?: string | null; amount_cents: number; challenge_id: string | null; buyer_key: string | null }, metadata: { challenge_id?: string; user_id?: string }, sessionId: string) {
  return session.payment_status === 'paid' && typeof session.payment_intent === 'string' && session.payment_intent.startsWith('pi_') && payment.stripe_session_id === sessionId && payment.challenge_id === metadata.challenge_id && payment.buyer_key === metadata.user_id && session.amount_total === payment.amount_cents;
}

/** Partial/add-on refunds never establish a full base refund. */
export const fullChallengeRefund = (amount: number, refunded: number) => amount > 0 && refunded >= amount;