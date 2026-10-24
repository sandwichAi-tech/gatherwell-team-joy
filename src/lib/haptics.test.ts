import { afterEach, describe, expect, it, vi } from 'vitest';
import { vibrateOnUserAction } from './haptics';

const originalVibrate = navigator.vibrate;
const originalActivation = navigator.userActivation;

afterEach(() => {
  Object.defineProperty(navigator, 'vibrate', { value: originalVibrate, configurable: true });
  Object.defineProperty(navigator, 'userActivation', { value: originalActivation, configurable: true });
});

describe('haptics', () => {
  it('does not call vibrate before the user has activated the page', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: false }, configurable: true });
    expect(vibrateOnUserAction(30)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('vibrates after a real user action', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true }, configurable: true });
    expect(vibrateOnUserAction([40, 40, 40])).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([40, 40, 40]);
  });
});
