import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ sign: vi.fn(), toast: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: () => state.sign }));
vi.mock('@/lib/event-waivers.functions', () => ({ signEventWaiverFile: {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('@/lib/i18n', () => ({ default: { t: (k: string) => k } }));
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
});