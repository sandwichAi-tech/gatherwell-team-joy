import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import en from '@/locales/en.json';
import { emptyPolicy, pickPolicyMode, policyFromEvent } from '@/lib/event-policy';
import { publicAvailability } from '@/lib/event-presentation';
import { spotsLeft, type FeedGathering } from '@/lib/landing';
import { tierSpotsLeft, tierState } from '@/lib/registration';

const i = i18next.createInstance();
await i.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
const t = i.t.bind(i) as unknown as (k: string, o?: Record<string, unknown>) => string;
const never = () => { throw new Error('should not ask'); };

describe('row 6: custom policy switching keeps the coach\'s words', () => {
  it('carries edited preset wording into Custom instead of replacing it', () => {
    const r = pickPolicyMode({ ...emptyPolicy(), mode: 'free_anytime' }, 'My own words', 'custom', false, t, null, never)!;
    expect(r.text).toBe('My own words');
    expect(r.config.edited).toBe(true);
  });
  it('restores earlier Custom wording after visiting a preset', () => {
    const r = pickPolicyMode({ ...emptyPolicy(), mode: 'paid_24h' }, t('policy.text.paid_24h'), 'custom', true, t, { text: 'Custom saved', edited: true }, never)!;
    expect(r.text).toBe('Custom saved');
  });
  it('asks before an edited preset is replaced, and keeps it when declined', () => {
    expect(pickPolicyMode({ ...emptyPolicy(), mode: 'paid_24h' }, 'Edited', 'paid_7d', true, t, null, () => false)).toBeNull();
    expect(pickPolicyMode({ ...emptyPolicy(), mode: 'paid_24h' }, 'Edited', 'paid_7d', true, t, null, () => true)!.text).toBe(t('policy.text.paid_7d'));
  });
  it('switches unedited presets without asking', () => {
    expect(pickPolicyMode({ ...emptyPolicy(), mode: 'paid_24h' }, t('policy.text.paid_24h'), 'paid_none', true, t, null, never)!.text).toBe(t('policy.text.paid_none'));
  });
  it('reopens saved custom wording exactly', () => {
    const p = policyFromEvent({ cancellation_policy: 'Email me 3 days ahead.', policy_config: { mode: 'custom', edited: true }, price_cents: 0 }, t);
    expect(p.config.mode).toBe('custom');
    expect(p.text).toBe('Email me 3 days ahead.');
  });
});

describe('row 96: public counts follow the host choice', () => {
  it('hidden counts give no number but still report sold out', () => {
    expect(publicAvailability({ going: null, capacity: 10, spots_left: null, is_full: true })).toEqual({ going: null, left: null, full: true });
  });
  it('remaining-only shows spots left without the registration count', () => {
    expect(publicAvailability({ going: null, capacity: 10, spots_left: 4, is_full: false })).toEqual({ going: null, left: 4, full: false });
  });
  it('unlimited events never show spots left', () => {
    expect(publicAvailability({ going: 7, capacity: null, spots_left: null, is_full: false }).left).toBeNull();
  });
  it('feed cards hide spots left when the host hid them', () => {
    const g = { isSample: false, capacity: 10, going: 0, countsHidden: true, serverLeft: null } as unknown as FeedGathering;
    expect(spotsLeft(g)).toBeNull();
    expect(spotsLeft({ ...g, serverLeft: 3 })).toBe(3);
  });
  it('tiers with hidden sales use the server sold-out flag only', () => {
    const tier = { id: 'a', name: 'GA', price_cents: 0, quantity: 5, sold_out: true } as never;
    expect(tierState(tier)).toBe('sold_out');
    expect(tierSpotsLeft(tier)).toBeNull();
  });
});
