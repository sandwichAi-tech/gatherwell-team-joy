import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonImageInput } from './addon-image-input';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), media: vi.fn(), clean: vi.fn() }));
vi.mock('@/lib/account', () => ({ uploadMedia: mocks.upload, mediaUrl: mocks.media }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: () => mocks.clean }));
vi.mock('@/lib/addon-images.functions', () => ({ cleanupAddonImages: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/brand-image', () => ({ BrandImage: () => null }));
vi.mock('@/components/image-crop', () => ({ CropFileInput: ({ onCropped, onRejected }: { onCropped: (r: unknown) => void; onRejected: (r: string) => void }) => <><input aria-label="test crop" type="file" onChange={() => onCropped({ file: new File(['pixels'], 'addon.webp', { type: 'image/webp' }), previewUrl: 'blob:test' })} /><input aria-label="test rejection" onChange={e => onRejected(e.target.value)} /></> }));
const owner = '11111111-1111-4111-8111-111111111111';
const previous = `${owner}/addon-22222222-2222-4222-8222-222222222222.webp`;
function mount(path: string | null = previous) {
  const changed = vi.fn(); const busy = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddonImageInput userId={owner} name="Mat" path={path} onChange={changed} onBusy={busy} /></QueryClientProvider>);
  return { changed, busy };
}
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue('ok'); mocks.media.mockResolvedValue('https://example.com/signed'); mocks.clean.mockResolvedValue(undefined); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);
describe('non-destructive add-on uploads', () => {
  it('does not replace the previous image when upload fails', async () => {
    mocks.upload.mockRejectedValue(new Error('network')); const { changed, busy } = mount();
    fireEvent.change(screen.getByLabelText('test crop'));
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
    expect(changed).not.toHaveBeenCalled(); expect(mocks.clean).toHaveBeenCalled();
  });
  it('does not replace the previous image when signed access fails', async () => {
    mocks.media.mockResolvedValue(null); const { changed, busy } = mount();
    fireEvent.change(screen.getByLabelText('test crop'));
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false)); expect(changed).not.toHaveBeenCalled();
  });
  it('replaces only after upload and signing succeed', async () => {
    const { changed } = mount(); fireEvent.change(screen.getByLabelText('test crop'));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(changed.mock.calls[0]?.[0]).toMatch(new RegExp(`^${owner}/addon-.*\\.webp$`));
  });
  it('removes the reference without immediately deleting saved media', () => {
    const { changed } = mount(); fireEvent.click(screen.getByRole('button', { name: 'addonImages.remove' }));
    expect(changed).toHaveBeenCalledWith(null); expect(mocks.clean).not.toHaveBeenCalled();
  });
  it('does not upload or change the reference after rejected input', () => {
    const { changed } = mount(null); fireEvent.change(screen.getByLabelText('test rejection'), { target: { value: 'size' } });
    expect(mocks.upload).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
});