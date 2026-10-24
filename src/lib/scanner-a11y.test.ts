import { describe, expect, it, vi } from 'vitest';
import { handleScannerDialogKeyDown, scannerFocusableElements } from './scanner-a11y';

function keyDown(key: string, shiftKey = false) {
  return new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
}

describe('scanner dialog keyboard access', () => {
  it('closes on Escape and prevents the key from reaching the page behind it', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button type="button">Close</button><input /><button type="submit">Check in</button>';
    document.body.append(root);
    const close = vi.fn();
    const event = keyDown('Escape');

    expect(handleScannerDialogKeyDown(event, root, close)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    root.remove();
  });

  it('keeps Tab and Shift+Tab inside the scanner controls', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button type="button">Close</button><input aria-label="Code" /><button type="submit">Check in</button>';
    document.body.append(root);
    const [closeButton, input, submit] = scannerFocusableElements(root) as [HTMLElement, HTMLElement, HTMLElement];
    const close = vi.fn();

    closeButton.focus();
    const backward = keyDown('Tab', true);
    expect(handleScannerDialogKeyDown(backward, root, close)).toBe(true);
    expect(document.activeElement).toBe(submit);

    const forward = keyDown('Tab');
    expect(handleScannerDialogKeyDown(forward, root, close)).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    input.focus();
    const middle = keyDown('Tab');
    expect(handleScannerDialogKeyDown(middle, root, close)).toBe(false);
    expect(middle.defaultPrevented).toBe(false);
    expect(close).not.toHaveBeenCalled();
    root.remove();
  });
});
