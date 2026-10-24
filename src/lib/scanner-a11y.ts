const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function scannerFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => element.getAttribute('aria-hidden') !== 'true',
  );
}

export function handleScannerDialogKeyDown(event: KeyboardEvent, root: HTMLElement, close: () => void): boolean {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return true;
  }
  if (event.key !== 'Tab') return false;

  const focusable = scannerFocusableElements(root);
  if (focusable.length === 0) {
    event.preventDefault();
    return true;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  const focusIsOutside = !active || !root.contains(active);

  if (event.shiftKey && (active === first || focusIsOutside)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
