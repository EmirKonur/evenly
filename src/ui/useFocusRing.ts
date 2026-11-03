import { useState } from 'react';
import { Platform } from 'react-native';

/**
 * Tracks whether the last interaction was a keyboard, so focus rings show for Tab users
 * (the :focus-visible behavior) without flashing on every mouse click or tap.
 */
let keyboardMode = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', () => (keyboardMode = true), true);
  document.addEventListener('pointerdown', () => (keyboardMode = false), true);
}

export function useFocusRing(options: { always?: boolean } = {}) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: () => setFocused(options.always || keyboardMode || Platform.OS !== 'web'),
    onBlur: () => setFocused(false),
  };
}
