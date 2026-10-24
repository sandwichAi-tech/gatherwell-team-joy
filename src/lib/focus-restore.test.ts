import { describe, expect, it } from 'vitest';
import { captureActiveElement, restoreElementFocus } from './focus-restore';

describe('sheet focus restoration', () => {
  it('restores focus to a connected trigger after the current frame', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    expect(captureActiveElement()).toBe(trigger);
    const scheduled: (() => void)[] = [];
    expect(restoreElementFocus(trigger, callback => scheduled.push(callback))).toBe(true);
    trigger.blur();
    scheduled.forEach(callback => callback());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('does not try to focus a trigger that was removed by the confirmed action', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.remove();
    expect(restoreElementFocus(trigger, callback => callback())).toBe(false);
  });
});
