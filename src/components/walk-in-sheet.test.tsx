import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
vi.mock('sonner', () => ({ toast: { success: state.success } }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock('@/components/responsive-sheet', () => ({ ResponsiveSheet: ({ open, children, footer }: any) => open ? <div>{children}{footer}</div> : null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));
import { WalkInSheet } from './walk-in-sheet';
beforeEach(() => { vi.clearAllMocks(); });
function fill() { fireEvent.change(screen.getByLabelText('guest.firstName'), { target: { value: 'ZZ-TEST Guest' } }); fireEvent.change(screen.getByLabelText('guest.email'), { target: { value: 'zz-test@example.invalid' } }); }
it('does not claim existing registration check-in from an empty server response', async () => {
  state.rpc.mockResolvedValueOnce({ data: { result: 'existing', rsvp_id: 'r', status: 'going', checked_in: false }, error: null }).mockResolvedValueOnce({ data: null, error: null });
  const close = vi.fn(); render(<WalkInSheet open eventId="e" onClose={close} onSaved={vi.fn()} />); fill();
  fireEvent.click(screen.getByText('checkin.addAndCheckIn')); await screen.findByText('checkin.checkExisting'); fireEvent.click(screen.getByText('checkin.checkExisting'));
  await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
  expect(close).not.toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
});
it('disables changing identity during an unresolved admission request', async () => {
  state.rpc.mockReturnValue(new Promise(() => {})); render(<WalkInSheet open eventId="e" onClose={vi.fn()} onSaved={vi.fn()} />); fill(); fireEvent.click(screen.getByText('checkin.addAndCheckIn'));
  await waitFor(() => expect(screen.getByLabelText('guest.email')).toBeDisabled());
});