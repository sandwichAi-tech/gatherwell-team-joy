import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc, from: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.title ? `${k}:${o.title}` : k), i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('@/components/responsive-sheet', () => ({ ResponsiveSheet: ({ open, children, footer }: any) => open ? <div role="dialog">{children}{footer}</div> : null }));
vi.mock('sonner', () => ({ toast: state.toast }));
import { HostEventCancelSheet, RegistrationCancelSheet } from './event-cancellation';
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
afterEach(() => { cleanup(); state.rpc.mockReset(); });

describe('host event cancellation', () => {
  it('stays disabled until the exact title is typed, then cancels once with refund requests', async () => {
    state.rpc.mockImplementation(async (fn: string) => fn === 'event_cancellation_summary' ? { data: { going: 3, waitlist: 1, paid: 2, refundable_cents: 6400, refunds: {} }, error: null }
      : fn === 'cancel_event_with_refunds' ? { data: { result: 'cancelled', refund_requests: 2 }, error: null } : { data: 2, error: null });
    const done = vi.fn();
    wrap(<HostEventCancelSheet event={{ id: 'ZZ-TEST-e', title: 'ZZ-TEST Yoga' }} open onClose={vi.fn()} onDone={done} />);
    const btn = screen.getByRole('button', { name: 'cancellation.host.confirm' });
    await screen.findByText('cancellation.host.paid');
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yes' } }); expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zz-test yoga' } }); expect(btn).not.toBeDisabled();
    fireEvent.click(btn); fireEvent.click(btn);
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(state.rpc.mock.calls.filter(c => c[0] === 'cancel_event_with_refunds')).toHaveLength(1);
    expect(state.toast.success).toHaveBeenCalledWith('cancellation.host.done');
  });
});

describe('attendee cancellation', () => {
  it('paid booking never falls back to a seat-only cancel when refund tracking is missing', async () => {
    state.rpc.mockImplementation(async (fn: string) => fn === 'registration_cancel_preview' ? { data: { policy: '24h', starts_at: '2026-12-10T18:00:00Z', paid_cents: 3500, booking_fee_cents: 300, eligibility: 'full', refund_status: null, refund_cents: null }, error: null }
      : fn === 'cancel_my_registration' ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } : { data: true, error: null });
    const done = vi.fn();
    wrap(<RegistrationCancelSheet code="zztestcode0000000003" open onClose={vi.fn()} onDone={done} />);
    await screen.findByText('cancellation.attendee.outcome.full');
    fireEvent.click(screen.getByRole('button', { name: 'guest.cancelRsvp' }));
    await screen.findByText('cancellation.errors.paidNotReady');
    expect(state.rpc.mock.calls.some(c => c[0] === 'cancel_rsvp_by_code')).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });
  it('free booking cancels and reports pending only when the server says so', async () => {
    state.rpc.mockImplementation(async (fn: string) => fn === 'registration_cancel_preview' ? { data: { policy: 'none', starts_at: '2026-12-10T18:00:00Z', paid_cents: null, booking_fee_cents: null, eligibility: 'free', refund_status: null, refund_cents: null }, error: null }
      : { data: { result: 'cancelled', refund: 'free' }, error: null });
    const done = vi.fn();
    wrap(<RegistrationCancelSheet code="zztestcode0000000001" open onClose={vi.fn()} onDone={done} />);
    await screen.findByText('cancellation.attendee.outcome.free');
    fireEvent.click(screen.getByRole('button', { name: 'guest.cancelRsvp' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(state.toast.success).toHaveBeenCalledWith('guest.toastCancelled');
  });
});
