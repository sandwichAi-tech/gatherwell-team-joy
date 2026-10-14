export const REFUND_POLICIES = ['24h', '7d', 'none'] as const;
export type RefundPolicy = (typeof REFUND_POLICIES)[number];
export const asRefundPolicy = (v: unknown): RefundPolicy => (REFUND_POLICIES as readonly unknown[]).includes(v) ? v as RefundPolicy : '24h';

/** Plain text for places outside i18n (card checkout page). Keep in sync with refunds.* in the locale files. */
export function refundText(p: RefundPolicy, lang: 'en' | 'es') {
  const en = { '24h': 'Full refund until 24 hours before', '7d': 'Full refund until 7 days before', none: 'No refunds' };
  const es = { '24h': 'Reembolso completo hasta 24 horas antes', '7d': 'Reembolso completo hasta 7 días antes', none: 'Sin reembolsos' };
  const always = lang === 'es' ? 'Si el anfitrión cancela, recibes el reembolso completo.' : 'If the host cancels, you get a full refund.';
  return `${(lang === 'es' ? es : en)[p]}. ${always}`;
}
