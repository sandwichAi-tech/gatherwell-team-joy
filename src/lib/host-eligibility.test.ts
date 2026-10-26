import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { canSwitchToHost } from './host-eligibility';
import { modeUpdate } from './switch-mode';
const m = (role: string, workspaceRole = 'member', ownerId = 'other') => ({ role, workspaceRole, ownerId });
describe('Host mode eligibility', () => {
  it('lets a team host switch back to hosting', () => expect(canSwitchToHost('u', [m('host')], 0)).toBe(true));
  it('lets a team owner switch back', () => expect(canSwitchToHost('u', [m('member', 'member', 'u')], 0)).toBe(true));
  it('lets someone who hosted an event switch back', () => expect(canSwitchToHost('u', [], 1)).toBe(true));
  it('never offers hosting to attendee-only members', () => expect(canSwitchToHost('u', [m('member')], 0)).toBe(false));
  it('never offers hosting to accounts without teams or events', () => expect(canSwitchToHost('u', [], 0)).toBe(false));
});
describe('Mode switch writes', () => {
  it('eligible hosts return without re-onboarding', () => expect(modeUpdate('host', true)).toEqual({ role_intent: 'host', view_mode: 'hosting' }));
  it('new hosts still go through onboarding', () => expect(modeUpdate('host', false)).toMatchObject({ onboarded: false }));
  it('switching to attending never resets onboarding', () => expect(modeUpdate('guest', true)).toEqual({ role_intent: 'guest', view_mode: 'attending' }));
});
