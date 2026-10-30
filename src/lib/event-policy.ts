/**
 * Event cancellation/refund policy: presets plus a guided custom builder.
 * Pure rules shared by the event builder, tests and (mirrored) set_event_policy().
 * Saved as events.cancellation_policy (exact attendee-facing text) + events.policy_config (fields).
 */

export const FREE_PRESETS = ['free_anytime', 'free_notify'] as const;
export const PAID_PRESETS = ['paid_24h', 'paid_7d', 'paid_none'] as const;
export type PolicyMode = '' | (typeof FREE_PRESETS)[number] | (typeof PAID_PRESETS)[number] | 'custom';
export type RefundKind = 'full' | 'percent' | 'none' | 'credit';
export type DeadlineUnit = 'hours' | 'days';
export type HostCancel = 'full' | 'reschedule_or_full';

export type PolicyConfig = {
  mode: PolicyMode;
  deadline: string; unit: DeadlineUnit;
  refund: RefundKind; percent: string;
  transfer: boolean; hostCancel: HostCancel;
  processingDays: string; exceptions: string; contact: string;
  /** True once the host typed into the text: field changes stop overwriting it. */
  edited: boolean;
  /** sha256 of the exact reviewed text; any later edit invalidates it. */
  reviewedSha: string | null;
};

export const emptyPolicy = (): PolicyConfig => ({
  mode: '', deadline: '24', unit: 'hours', refund: 'full', percent: '50', transfer: false, hostCancel: 'full',
  processingDays: '10', exceptions: '', contact: '', edited: false, reviewedSha: null,
});

type T = (key: string, opts?: Record<string, unknown>) => string;

export const presetsFor = (paid: boolean): PolicyMode[] => (paid ? [...PAID_PRESETS] : [...FREE_PRESETS]);
export const modeFitsPrice = (mode: PolicyMode, paid: boolean) =>
  mode === '' || mode === 'custom' || (presetsFor(paid) as string[]).includes(mode);

/** refund_policy column value the server derives for a paid event. */
export const refundPolicyFor = (mode: PolicyMode): '24h' | '7d' | 'none' | 'custom' | null =>
  mode === 'paid_24h' ? '24h' : mode === 'paid_7d' ? '7d' : mode === 'paid_none' ? 'none' : mode === 'custom' ? 'custom' : null;

/** Plain-language draft generated from the guided fields. Free events never mention money. */
export function buildPolicyText(c: PolicyConfig, paid: boolean, t: T): string {
  if (c.mode !== 'custom') return c.mode ? t(`policy.text.${c.mode}`) : '';
  const n = Number(c.deadline) || 0;
  const when = t(`policy.build.when_${c.unit}`, { count: n });
  const parts: string[] = [];
  if (!paid) {
    parts.push(t('policy.build.freeIntro'));
    parts.push(n > 0 ? t('policy.build.freeCancelBy', { when }) : t('policy.build.freeCancelAny'));
    if (c.transfer) parts.push(t('policy.build.freeTransfer'));
    parts.push(t(c.hostCancel === 'full' ? 'policy.build.freeHostCancels' : 'policy.build.freeHostReschedules'));
  } else {
    if (c.refund === 'none') parts.push(t('policy.build.noRefund'));
    else if (c.refund === 'full') parts.push(t('policy.build.fullBy', { when }));
    else if (c.refund === 'percent') parts.push(t('policy.build.percentBy', { when, percent: Number(c.percent) || 0 }));
    else parts.push(t('policy.build.creditBy', { when }));
    if (c.refund !== 'none') parts.push(t('policy.build.afterDeadline'));
    parts.push(t(c.transfer ? 'policy.build.transferYes' : 'policy.build.transferNo'));
    parts.push(t(c.hostCancel === 'full' ? 'policy.build.hostFull' : 'policy.build.hostReschedule'));
    if (c.refund !== 'none' && Number(c.processingDays) > 0) parts.push(t('policy.build.processing', { count: Number(c.processingDays) }));
  }
  if (c.exceptions.trim()) parts.push(t('policy.build.exceptions', { text: c.exceptions.trim().replace(/[.\s]+$/, '') }));
  if (c.contact.trim()) parts.push(t('policy.build.contact', { contact: c.contact.trim() }));
  return parts.join(' ');
}

/** True when the visible wording differs from what the current option would generate (host edits at stake). */
export function policyTextEdited(c: PolicyConfig, text: string, paid: boolean, t: T): boolean {
  if (c.mode === '') return false;
  if (c.mode === 'custom') return c.edited;
  return normalizePolicyText(text) !== normalizePolicyText(t(`policy.text.${c.mode}`));
}

/**
 * Switching options. Custom wording typed earlier is restored when returning to Custom; edited preset text
 * carries into Custom instead of being replaced; leaving edited text for a preset needs explicit confirmation.
 */
export function pickPolicyMode(c: PolicyConfig, text: string, mode: PolicyMode, paid: boolean, t: T,
  kept: { text: string; edited: boolean } | null, confirmReplace: () => boolean): { config: PolicyConfig; text: string } | null {
  if (mode === c.mode) return null;
  const edited = policyTextEdited(c, text, paid, t);
  if (mode === 'custom') {
    if (kept?.edited) return { config: { ...c, mode, edited: true, reviewedSha: null }, text: kept.text };
    if (edited) return { config: { ...c, mode, edited: true, reviewedSha: null }, text };
    const next = { ...c, mode, edited: false, reviewedSha: null };
    return { config: next, text: buildPolicyText(next, paid, t) };
  }
  if (edited && c.mode !== 'custom' && !confirmReplace()) return null;
  return { config: { ...c, mode, edited: false, reviewedSha: null }, text: mode ? t(`policy.text.${mode}`) : '' };
}

/** Exactly what the server stores and hashes. */
export const normalizePolicyText = (s: string) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').slice(0, 1000);

export type PolicyIssue = 'mode_required' | 'mismatch' | 'deadline' | 'percent' | 'text' | 'review' | 'contradiction';

/** Problems to fix before saving (draft) or publishing. Only checks fields relevant to the choice. */
export function policyIssues(c: PolicyConfig, text: string, paid: boolean, publish: boolean): PolicyIssue[] {
  const out: PolicyIssue[] = [];
  if (!modeFitsPrice(c.mode, paid)) out.push('mismatch');
  if (paid && publish && c.mode === '') out.push('mode_required');
  if (c.mode === '') return out;
  const body = normalizePolicyText(text);
  if (!body) out.push('text');
  if (c.mode === 'custom') {
    if (paid) {
      const d = Number(c.deadline);
      if (c.refund !== 'none' && (!Number.isInteger(d) || d < 1 || d > 365)) out.push('deadline');
      const p = Number(c.percent);
      if (c.refund === 'percent' && (!Number.isInteger(p) || p < 1 || p > 99)) out.push('percent');
      // A "no refunds" policy whose text still promises a refund contradicts itself.
      if (c.refund === 'none' && /\b(full refund|reembolso completo)\b/i.test(body) && !/host|anfitri/i.test(body)) out.push('contradiction');
    } else if (/(refund|reembolso)/i.test(body)) out.push('contradiction');
    if (publish && body) out.push(...(c.reviewedSha ? [] : (['review'] as PolicyIssue[])));
  }
  return out;
}

/** Legacy events (no saved config): infer the mode from the stored text/refund value so nothing is lost. */
export function policyFromEvent(e: { cancellation_policy?: string | null; policy_config?: unknown; refund_policy?: string | null; price_cents?: number | null }, t: T): { config: PolicyConfig; text: string } {
  const text = e.cancellation_policy ?? '';
  const saved = e.policy_config && typeof e.policy_config === 'object' ? (e.policy_config as Partial<PolicyConfig>) : null;
  if (saved && typeof saved.mode === 'string') return { config: { ...emptyPolicy(), ...saved, mode: saved.mode as PolicyMode }, text };
  const paid = (e.price_cents ?? 0) > 0;
  const match = presetsFor(paid).find(p => t(`policy.text.${p}`) === text);
  if (match) return { config: { ...emptyPolicy(), mode: match }, text };
  if (text.trim()) return { config: { ...emptyPolicy(), mode: 'custom', edited: true }, text };
  return { config: emptyPolicy(), text: '' };
}

/** Payload for set_event_policy(): fields plus the server-checkable review hash. */
export const policyPayload = (c: PolicyConfig, text: string) => ({
  config: c.mode === '' ? {} : {
    mode: c.mode, deadline: c.deadline, unit: c.unit, refund: c.refund, percent: c.percent, transfer: c.transfer, hostCancel: c.hostCancel,
    processingDays: c.processingDays, exceptions: c.exceptions, contact: c.contact, edited: c.edited, reviewed_sha: c.reviewedSha, reviewedSha: c.reviewedSha,
  },
  text: c.mode === '' ? '' : normalizePolicyText(text),
});

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
