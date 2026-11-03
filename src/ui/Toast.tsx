import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';

interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; onPress: () => void };
}

type ShowToast = (text: string, action?: ToastMessage['action']) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

/** One toast at a time, bottom of the screen, gone after four seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const counter = useRef(0);
  const show = useCallback<ShowToast>((text, action) => {
    counter.current += 1;
    setMessage({ id: counter.current, text, action });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Toast key={message.id} message={message} onDone={() => setMessage(null)} />
      ) : null}
    </ToastContext.Provider>
  );
}

function Toast({ message, onDone }: { message: ToastMessage; onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.host, { paddingBottom: insets.bottom + 88 }]}
    >
      <Animated.View
        entering={FadeInDown.springify().damping(16)}
        exiting={FadeOutDown}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: colors.ink }]}
      >
        <Text variant="label" style={[styles.text, { color: colors.background }]}>
          {message.text}
        </Text>
        {message.action ? (
          <PressableScale
            onPress={() => {
              message.action?.onPress();
              onDone();
            }}
            accessibilityLabel={message.action.label}
            style={styles.action}
          >
            <Text variant="label" style={{ color: colors.highlight }}>
              {message.action.label}
            </Text>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: space.xl },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    maxWidth: 480,
    width: '100%',
  },
  text: { flex: 1 },
  action: { paddingVertical: space.xs, paddingHorizontal: space.sm },
});
