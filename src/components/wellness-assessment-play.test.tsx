import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { WellnessAssessmentPlay } from './wellness-assessment-play';
const state = vi.hoisted(() => ({ rpc: vi.fn(), history: [] as any[], fail: false }));
vi.mock('@/components/learn', () => ({ useLearn: () => ({ userId: 'ZZ-TEST-participant' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: any[]) => state.rpc(...args) } }));
beforeEach(async () => {
  await i18n.changeLanguage('en'); state.history = []; state.fail = false;
  state.rpc.mockReset(); state.rpc.mockImplementation(async (name, args) => {
    if (name === 'assessment_for_learner') return { data: { revision: 1, scope: { id: 'scope', version: 1, text: 'ZZ-TEST only' }, history: state.history, config: { allow_retake: true, questions: [1, 2].map(n => ({ id: `q${n}`, prompt: `ZZ-TEST question ${n}`, type: 'single', scored: n === 1, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })) } }, error: null };
    if (state.fail) return { data: null, error: { message: 'ZZ-TEST network failure' } };
    state.history = [{ id: 'receipt', score: 100, completed_at: '2026-10-31T00:00:00Z', result: null }];
    return { data: state.history[0], error: null };
  });
});
afterEach(cleanup);
async function open() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WellnessAssessmentPlay id="ZZ-TEST" /></QueryClientProvider>);
  await screen.findByText('ZZ-TEST question 2');
}
it('replaces a single choice independently in scored and unscored participant questions', async () => {
  await open();
  for (const n of [1, 2]) {
    const question = within(screen.getByRole('group', { name: `ZZ-TEST question ${n}` }));
    fireEvent.click(question.getByRole('radio', { name: 'A' }));
    fireEvent.click(question.getByRole('radio', { name: 'B' }));
    expect(question.getByRole('radio', { name: 'A' })).not.toBeChecked();
    expect(question.getByRole('radio', { name: 'B' })).toBeChecked();
  }
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: i18n.t('lifecycle.complete') }));
  await screen.findByText('100 / 100');
  expect(state.rpc.mock.calls.find(([name]) => name === 'complete_wellness_assessment')?.[1]._answers).toEqual({ q1: ['b'], q2: ['b'] });
});
it('retries a failed submission using the same request ID and never creates preview evidence', async () => {
  await open(); state.fail = true;
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: i18n.t('lifecycle.complete') }));
  await screen.findByRole('alert'); state.fail = false;
  fireEvent.click(screen.getByRole('button', { name: i18n.t('lifecycle.complete') }));
  await waitFor(() => expect(screen.getByText('100 / 100')).toBeVisible());
  const calls = state.rpc.mock.calls.filter(([name]) => name === 'complete_wellness_assessment');
  expect(calls).toHaveLength(2); expect(calls[0]?.[1]._request).toBe(calls[1]?.[1]._request);
});