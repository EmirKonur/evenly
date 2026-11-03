import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

export interface Shortcut {
  key: string;
  description: string;
  run: () => void;
}

/**
 * Single-key shortcuts for the web build (phones have no keyboard to speak of). Ignored
 * while typing in a field and when a modifier is held, so browser shortcuts still work.
 */
export function useShortcuts(shortcuts: readonly Shortcut[]) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
      return;
    const match = shortcuts.find((shortcut) => shortcut.key === event.key);
    if (!match) return;
    event.preventDefault();
    match.run();
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
