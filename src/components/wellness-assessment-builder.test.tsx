import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { WellnessAssessmentBuilder } from './wellness-assessment-builder';

const state = vi.hoisted(() => ({ config: null as any, revision: 0, failDest: false, rpc: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <a>{children}</a>, useNavigate: () => vi.fn() }));
vi.mock('@/components/learn', () => ({ useLearn: () => ({ userId: 'ZZ-TEST-owner', teamId: 'ZZ-TEST-team' }) }));
vi.mock('@/components/confirm-dialog', () => ({ confirmAction: async () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const result = { data: table === 'quizzes' ? { id: 'ZZ-TEST-assessment', host_id: 'ZZ-TEST-owner', assessment_config: state.config, assessment_revision: state.revision } : [], error: null };
    const chain: any = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, maybeSingle: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) };
    return chain;
  },
  rpc: (...args: any[]) => state.rpc(...args),
} }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  state.revision = 1; state.failDest = false;
  state.config = { kind: 'wellness_assessment', title_en: 'ZZ-TEST assessment', title_es: '', description_en: '', description_es: '', language: 'en', allow_retake: false, questions: [1, 2].map(n => ({ id: `q${n}`, type: 'single', prompt: `ZZ-TEST question ${n}`, scored: true, weight: n, options: [{ id: `q${n}a`, label: `First ${n}`, value: 0 }, { id: `q${n}b`, label: `Second ${n}`, value: 100 }] })), results: [{ id: 'r', min: 0, max: 100, title: 'ZZ-TEST result', body: 'Fixture only', url: '' }] };
  state.rpc.mockReset(); state.rpc.mockImplementation(async (name, args) => {
    if (name === 'resource_destinations') return { data: { team: true, coach: false, courses: [] }, error: null };
    if (name === 'save_wellness_assessment') { state.config = structuredClone(args._config); state.revision++; return { data: { id: 'ZZ-TEST-assessment', revision: state.revision }, error: null }; }
    return { data: [], error: name === 'set_resource_destinations' && state.failDest ? { message: 'ZZ-TEST destination failure' } : null };
  });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 0; });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function open() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WellnessAssessmentBuilder id="ZZ-TEST-assessment" /></QueryClientProvider>);
  await screen.findByRole('heading', { name: 'ZZ-TEST assessment' });
  fireEvent.click(screen.getByRole('tab', { name: i18n.t('assessment.steps.questions') }));
  return within(screen.getByDisplayValue('ZZ-TEST question 2').closest('li') as HTMLElement);
}

it('reproduces question 2 score toggles without changing either question labels', async () => {
  const q2 = await open();
  fireEvent.change(q2.getByLabelText(i18n.t('assessment.option', { n: 1 })), { target: { value: 'ZZ-TEST changed second question' } });
  for (let n = 0; n < 6; n++) fireEvent.click(q2.getByRole('switch'));
  expect(q2.getByDisplayValue('ZZ-TEST changed second question')).toBeVisible();
  expect(screen.getByDisplayValue('First 1')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('resources.item.saveDraft') }));
  await waitFor(() => expect(state.config.questions[1].options[0].label).toBe('ZZ-TEST changed second question'));
  expect(state.config.questions[0].options[0].label).toBe('First 1');
});

it('keeps question 2 labels and scores when changing to text and back', async () => {
  const q2 = await open();
  fireEvent.change(q2.getByLabelText(i18n.t('quiz.questionType')), { target: { value: 'text' } });
  fireEvent.change(q2.getByLabelText(i18n.t('quiz.questionType')), { target: { value: 'single' } });
  expect(q2.getByDisplayValue('First 2')).toBeVisible();
  expect(q2.getByDisplayValue('Second 2')).toBeVisible();
});