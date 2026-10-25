import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import {
  buildPolicyText, emptyPolicy, normalizePolicyText, policyFromEvent, policyIssues, policyPayload, refundPolicyFor, sha256Hex, type PolicyConfig,
} from '@/lib/event-policy';
import {
  acceptedPayload, canAccept, consentRows, consentState, initialChoices, missingRequired, waiverErrorKey, waiversReady, type PublicWaiver, type WaiverStatus,
} from '@/lib/event-waivers';
import { refundText } from '@/lib/refunds';

const mk = async (lng: 'en' | 'es') => {
  const i = i18next.createInstance();
  await i.init({ lng, resources: { en: { translation: en }, es: { translation: es } }, interpolation: { escapeValue: false } });
  return i.t.bind(i) as unknown as (k: string, o?: Record<string, unknown>) => string;
};
const custom = (p: Partial<PolicyConfig> = {}): PolicyConfig => ({ ...emptyPolicy(), mode: 'custom', ...p });

describe('custom policy builder', () => {
  it('generates paid percentage terms with deadline, transfer and processing time', async () => {
    const t = await mk('en');
    const text = buildPolicyText(custom({ refund: 'percent', percent: '50', deadline: '7', unit: 'days', transfer: true, processingDays: '5', contact: 'reply to your email' }), true, t);
    expect(text).toContain('7 days before the start for a 50% refund');
    expect(text).toContain('You can transfer your ticket');
    expect(text).toContain('within 5 business days');
    expect(text).toContain('To cancel or ask a question: reply to your email.');
  });
  it('free custom text never promises a monetary refund (EN and ES)', async () => {
    for (const lng of ['en', 'es'] as const) {
      const text = buildPolicyText(custom({ refund: 'full', deadline: '24' }), false, await mk(lng));
      expect(text).not.toMatch(/refund|reembolso/i);
      expect(policyIssues(custom(), text, false, true).filter(i => i !== 'review')).toEqual([]);
    }
  });
  it('flags refund language in a free policy', () => {
    expect(policyIssues(custom({ edited: true }), 'Full refund until the day before.', false, false)).toContain('contradiction');
  });
  it('validates only relevant fields: deadline and percent ranges', () => {
    expect(policyIssues(custom({ refund: 'percent', percent: '0' }), 'x', true, false)).toContain('percent');
    expect(policyIssues(custom({ refund: 'percent', percent: '100' }), 'x', true, false)).toContain('percent');
    expect(policyIssues(custom({ refund: 'full', deadline: '' }), 'x', true, false)).toContain('deadline');
    expect(policyIssues(custom({ refund: 'none', deadline: '' }), 'Sales are final.', true, false)).toEqual([]);
  });
  it('flags a no-refund choice whose text promises a full refund', () => {
    expect(policyIssues(custom({ refund: 'none' }), 'Full refund anytime.', true, false)).toContain('contradiction');
  });
  it('requires explicit review before publishing a custom policy, but not for a draft', () => {
    expect(policyIssues(custom({ refund: 'none' }), 'Sales are final.', true, true)).toContain('review');
    expect(policyIssues(custom({ refund: 'none' }), 'Sales are final.', true, false)).not.toContain('review');
    expect(policyIssues(custom({ refund: 'none', reviewedSha: 'abc' }), 'Sales are final.', true, true)).not.toContain('review');
  });
  it('paid events need a policy to publish; presets must match the price', () => {
    expect(policyIssues(emptyPolicy(), '', true, true)).toContain('mode_required');
    expect(policyIssues({ ...emptyPolicy(), mode: 'free_anytime' }, 'x', true, false)).toContain('mismatch');
    expect(policyIssues({ ...emptyPolicy(), mode: 'paid_7d' }, 'x', false, false)).toContain('mismatch');
  });
  it('maps presets and custom to the stored refund value', () => {
    expect(refundPolicyFor('paid_24h')).toBe('24h'); expect(refundPolicyFor('paid_7d')).toBe('7d');
    expect(refundPolicyFor('paid_none')).toBe('none'); expect(refundPolicyFor('custom')).toBe('custom'); expect(refundPolicyFor('free_anytime')).toBeNull();
  });
  it('reopens saved config, legacy preset text and legacy free text without losing edits', async () => {
    const t = await mk('en');
    const saved = policyFromEvent({ cancellation_policy: 'My words', policy_config: { mode: 'custom', refund: 'credit', edited: true }, price_cents: 1000 }, t);
    expect(saved.config.mode).toBe('custom'); expect(saved.config.refund).toBe('credit'); expect(saved.text).toBe('My words');
    expect(policyFromEvent({ cancellation_policy: t('policy.text.paid_7d'), price_cents: 1000 }, t).config.mode).toBe('paid_7d');
    const legacy = policyFromEvent({ cancellation_policy: 'Email me to cancel', price_cents: 0 }, t);
    expect(legacy.config).toMatchObject({ mode: 'custom', edited: true }); expect(legacy.text).toBe('Email me to cancel');
  });
  it('payload carries the exact normalized text and the review hash the server compares', async () => {
    const text = '  Sales are final.\n';
    const sha = await sha256Hex(normalizePolicyText(text));
    const p = policyPayload(custom({ refund: 'none', reviewedSha: sha }), text);
    expect(p.text).toBe('Sales are final.');
    expect((p.config as { reviewed_sha: string }).reviewed_sha).toBe(sha);
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(policyPayload(emptyPolicy(), 'ignored')).toEqual({ config: {}, text: '' });
  });
  it('checkout message uses the exact custom text', () => {
    expect(refundText('custom', 'en', 'Credit only.')).toBe('Credit only.');
    expect(refundText('24h', 'es')).toContain('24 horas');
  });
});

const w = (p: Partial<PublicWaiver>): PublicWaiver => ({ id: 'w1', kind: 'waiver', title_en: 'Release', title_es: 'Exención', body_en: 'Body', body_es: 'Texto', has_file: false, file_name: null, required: true, version: 1, ...p });

describe('event waivers', () => {
  it('starts every acceptance unchecked', () => {
    expect(initialChoices([w({}), w({ id: 'w2' })])).toEqual({ w1: { accepted: false, opened: false }, w2: { accepted: false, opened: false } });
  });
  it('required items block, optional items never block', () => {
    const list = [w({}), w({ id: 'opt', required: false })];
    expect(waiversReady(list, initialChoices(list))).toBe(false);
    expect(waiversReady(list, { w1: { accepted: true, opened: false }, opt: { accepted: false, opened: false } })).toBe(true);
    expect(missingRequired(list, {}).map(x => x.id)).toEqual(['w1']);
  });
  it('a file waiver must be opened before it can be accepted', () => {
    const f = w({ has_file: true });
    expect(canAccept(f, { accepted: true, opened: false })).toBe(false);
    expect(waiversReady([f], { w1: { accepted: true, opened: false } })).toBe(false);
    expect(waiversReady([f], { w1: { accepted: true, opened: true } })).toBe(true);
  });
  it('sends only id + the version seen; no client time or hash', () => {
    const list = [w({ version: 3 }), w({ id: 'opt', required: false })];
    const p = acceptedPayload(list, { w1: { accepted: true, opened: false }, opt: { accepted: false, opened: false } });
    expect(p).toEqual([{ id: 'w1', version: 3 }]);
    expect(Object.keys(p[0]!)).toEqual(['id', 'version']);
  });
  it('host status distinguishes current, outdated, missing and skipped optional', () => {
    const s: WaiverStatus = { waivers: [{ id: 'w1', title_en: 'Release', title_es: 'Exención', required: true, version: 2 }, { id: 'm', title_en: 'Media', title_es: 'Fotos', required: false, version: 1 }],
      attendees: [{ rsvp_id: 'r1', name: 'Ana', status: 'going', accepted: { w1: { version: 2, at: '2026-10-25T10:00:00Z' } } }, { rsvp_id: 'r2', name: 'Ben', status: 'going', accepted: { w1: { version: 1, at: '2026-10-20T10:00:00Z' } } }, { rsvp_id: 'r3', name: 'Cy', status: 'going', accepted: {} }] };
    expect(s.attendees.map(a => consentState(s.waivers[0]!, a))).toEqual(['current', 'outdated', 'missing']);
    expect(consentState(s.waivers[1]!, s.attendees[0]!)).toBe('optional_skipped');
    const rows = consentRows(s, 'es', k => k);
    expect(rows[0]).toContain('Exención');
    expect(rows.flat().join(' ')).not.toMatch(/@|\+1/); // export carries no contact details
  });
  it('maps server waiver errors to localized keys', () => {
    expect(waiverErrorKey('ERROR: waiver_stale')).toBe('eventWaivers.errors.stale');
    expect(waiverErrorKey('waiver_required')).toBe('eventWaivers.errors.required');
    expect(waiverErrorKey('other')).toBeNull();
  });
});

describe('EN/ES copy', () => {
  const keys = (o: unknown, p = ''): string[] => typeof o === 'object' && o ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];
  it('policy and waiver keys match in both languages', () => {
    expect(keys((es as Record<string, unknown>)['eventWaivers']).sort()).toEqual(keys((en as Record<string, unknown>)['eventWaivers']).sort());
    expect(keys((es as Record<string, unknown>)['policy']).sort()).toEqual(keys((en as Record<string, unknown>)['policy']).sort());
  });
  it('Spanish labels are translated', async () => {
    const t = await mk('es');
    expect(t('eventWaivers.required')).toBe('Obligatorio');
    expect(t('policy.reviewConfirm')).toMatch(/Revisé/);
  });
});
