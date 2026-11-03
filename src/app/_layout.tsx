import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RepositoryContext } from '@/data/RepositoryContext';
import { useAppRepository } from '@/data/useAppRepository';
import { StartupError } from '@/features/onboarding/StartupError';
import { fontAssets } from '@/ui/fonts';
import { fonts, useTheme } from '@/ui/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const store = useAppRepository();
  const ready = (fontsLoaded || fontError !== null) && store.status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: theme.colors.background,
      primary: theme.colors.primary,
      text: theme.colors.ink,
      border: theme.colors.line,
    },
    fonts: { ...base.fonts, regular: { fontFamily: fonts.body, fontWeight: '400' as const } },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ThemeProvider value={navigationTheme}>
        {store.status === 'error' ? (
          <StartupError error={store.error} />
        ) : (
          <RepositoryContext.Provider value={store.repository}>
            <ToastProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              >
                <Stack.Screen name="groups/new" options={{ presentation: 'modal' }} />
                <Stack.Screen
                  name="groups/[groupId]/expense/new"
                  options={{ presentation: 'modal' }}
                />
                <Stack.Screen
                  name="groups/[groupId]/expense/[expenseId]"
                  options={{ presentation: 'modal' }}
                />
                <Stack.Screen
                  name="groups/[groupId]/add-friend"
                  options={{ presentation: 'modal' }}
                />
              </Stack>
            </ToastProvider>
          </RepositoryContext.Provider>
        )}
      </ThemeProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}
