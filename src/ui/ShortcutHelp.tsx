import { Keyboard } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { IconButton } from './IconButton';
import { Surface } from './Surface';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';
import type { Shortcut } from './useShortcuts';

/** The "?" cheatsheet for web keyboard shortcuts. Renders nothing on phones. */
export function ShortcutHelp({
  shortcuts,
  open,
  onToggle,
}: {
  shortcuts: readonly Shortcut[];
  open: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') return null;
  return (
    <>
      <IconButton icon={Keyboard} label="Keyboard shortcuts (?)" onPress={onToggle} />
      {open ? (
        <View style={styles.anchor} pointerEvents="box-none">
          <Surface style={styles.sheet}>
            <Text variant="label">Keyboard shortcuts</Text>
            {shortcuts.map((shortcut) => (
              <View key={shortcut.key} style={styles.row}>
                <View
                  style={[styles.key, { borderColor: colors.line, backgroundColor: colors.sunken }]}
                >
                  <Text variant="label">{shortcut.key === 'Escape' ? 'Esc' : shortcut.key}</Text>
                </View>
                <Text variant="caption" tone="soft">
                  {shortcut.description}
                </Text>
              </View>
            ))}
          </Surface>
        </View>
      ) : null}
    </>
  );
}

export function useShortcutHelp() {
  const [open, setOpen] = useState(false);
  return { open, toggle: () => setOpen((value) => !value), close: () => setOpen(false) };
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', top: 52, right: 0, zIndex: 10 },
  sheet: { gap: space.sm, minWidth: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  key: {
    minWidth: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
