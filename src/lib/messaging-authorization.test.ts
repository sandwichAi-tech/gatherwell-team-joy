import { describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
 const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { getJourneyRuns, listCommunicationOfferings, saveMessageJourney } from './messaging.functions';
type Handler = (args: { data: Record<string, unknown>; context: { supabase: { rpc: ReturnType<typeof vi.fn> } } }) => Promise<unknown>;
describe('Communication server authorization boundaries', () => {
 it('uses caller-scoped offering choices and propagates denied access', async () => {
  const rpc = vi.fn().mockResolvedValue({ error: { message: 'forbidden' } });
  await expect((listCommunicationOfferings as unknown as Handler)({ data: { teamId: 'other-team' }, context: { supabase: { rpc } } })).rejects.toThrow('forbidden');
  expect(rpc).toHaveBeenCalledWith('communication_offerings', { _team: 'other-team' });
 });
 it('uses authorized aggregate resource activity rather than raw run snapshots', async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ id: 'own-run', context: 'resource' }], error: null });
  expect(await (getJourneyRuns as unknown as Handler)({ data: { teamId: 'own-team', journeyId: 'own-journey', limit: 20 }, context: { supabase: { rpc } } })).toEqual([{ id: 'own-run', context: 'resource' }]);
  expect(rpc).toHaveBeenLastCalledWith('resource_journey_activity', { _team: 'own-team', _journey: 'own-journey', _limit: 20 });
 });
 it('preserves resource authorization errors instead of showing false successful saves', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } });
  await expect((saveMessageJourney as unknown as Handler)({ data: { teamId: 'other-team', name: 'Journey', start_trigger: 'resource_enrollment', offerId: 'private-offer', steps: [] }, context: { supabase: { rpc } } })).rejects.toThrow('forbidden');
  expect(rpc).toHaveBeenCalledTimes(1);
 });
});