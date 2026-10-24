export function vibrateOnUserAction(pattern: VibratePattern): boolean {
  if (!('vibrate' in navigator) || !navigator.userActivation?.hasBeenActive) return false;
  return navigator.vibrate(pattern);
}
