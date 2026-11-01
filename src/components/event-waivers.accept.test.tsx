import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ sign: vi.fn(), toast: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: () => state.sign }));
vi.mock('@/lib/event-waivers.functions', () => ({ signEventWaiverFile: {} }));
vi.mock('@/lib/host-waivers.functions', () => ({ uploadHostWaiver: {}, cleanupHostWaiverUpload: {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('@/lib/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('@/components/responsive-sheet', () => ({ ResponsiveSheet: ({ open, children, footer }: any) => open ? <div role="dialog">{children}{footer}</div> : null }));
vi.mock('@/components/lang-fields', () => ({ LangPair: () => null }));
vi.mock('sonner', () => ({ toast: { error: state.toast } }));
import { EventWaiversAccept } from './event-waivers';
afterEach(cleanup);
describe('attendee waiver file retry', () => {
  it('does not mark accepted or leave opening disabled when signing fails', async () => {
    state.sign.mockRejectedValue(new Error('ZZ-TEST network failure'));
    vi.spyOn(window, 'open').mockReturnValue(null);
    const change = vi.fn();
    render(<EventWaiversAccept waivers={[{ id: 'ZZ-TEST-form', kind: 'waiver', title_en: 'ZZ-TEST', title_es: '', body_en: '', body_es: '', has_file: true, file_name: 'test.pdf', required: true, version: 1 }]} choices={{}} onChange={change} />);
    const button = screen.getByRole('button', { name: 'eventWaivers.openFile' });
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(state.toast).toHaveBeenCalledWith('eventWaivers.errors.file');
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('opens the document in-page, never navigates away, and viewing alone does not accept', async () => {
    state.sign.mockResolvedValue({ url: 'https://example.invalid/zz-test.pdf' });
    const open = vi.spyOn(window, 'open'); const assign = vi.fn();
    const change = vi.fn();
    render(<EventWaiversAccept waivers={[{ id: 'ZZ-TEST-form', kind: 'waiver', title_en: 'ZZ-TEST', title_es: '', body_en: '', body_es: '', has_file: true, file_name: 'test.pdf', required: true, version: 1 }]} choices={{}} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'eventWaivers.openFile' }));
    const close = await screen.findByRole('button', { name: 'eventWaivers.viewer.close' });
    expect(open).not.toHaveBeenCalled(); expect(assign).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledWith({ 'ZZ-TEST-form': { accepted: false, opened: true } });
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('browser Back closes the viewer instead of leaving the page', async () => {
    state.sign.mockResolvedValue({ url: 'https://example.invalid/zz-test.pdf' });
    render(<EventWaiversAccept waivers={[{ id: 'ZZ-TEST-form', kind: 'waiver', title_en: 'ZZ-TEST', title_es: '', body_en: '', body_es: '', has_file: true, file_name: 'test.pdf', required: true, version: 1 }]} choices={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'eventWaivers.openFile' }));
    await screen.findByRole('dialog');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
