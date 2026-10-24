export function captureActiveElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function restoreElementFocus(
  element: HTMLElement | null,
  schedule: (callback: () => void) => void = callback => requestAnimationFrame(callback),
): boolean {
  if (!element?.isConnected) return false;
  schedule(() => element.focus());
  return true;
}
