import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics for the moments that matter: picking a person, assigning an item, saving, and
 * settling. Browsers have no equivalent, so every call is a no-op on web.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(effect: () => Promise<void>) {
  if (enabled) effect().catch(() => undefined);
}

export const haptics = {
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => fire(() => Haptics.selectionAsync()),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
