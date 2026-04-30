export type HapticEvent = 'selection' | 'start' | 'success' | 'warning';

const hapticPatterns: Record<HapticEvent, number | number[]> = {
  selection: 8,
  start: 14,
  success: [12, 36, 18],
  warning: [22, 42, 22],
};

export const HAPTICS_STORAGE_KEY = 'hapticsEnabled';

export const areHapticsEnabled = () => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
  if (stored === null) return true;

  try {
    return JSON.parse(stored) !== false;
  } catch {
    return stored !== 'false';
  }
};

export const playHaptic = (event: HapticEvent = 'selection') => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (!areHapticsEnabled()) return;

  navigator.vibrate(hapticPatterns[event]);
};
