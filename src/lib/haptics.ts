/** A short tick on devices that support vibration (Android); a no-op elsewhere. */
export function haptic(pattern: number | number[] = 8) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
