import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PropsWithChildren, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { env } from '@/config/env';

import { ToastHost } from '../design-system/components/feedback';
import { useTheme } from '../design-system/theme/use-theme';
import { AppServices, ServicesProvider } from '../providers/services';
import { usePreferences } from '../state/preferences-store';
import { useSession } from '../state/session-store';
import { FONT_MAP } from './fonts';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type AppRootProps = PropsWithChildren<{ boot: () => Promise<AppServices> }>;

/** Keeps runtime services in sync with preferences, connectivity and app state. */
function Runtime({ services }: { services: AppServices }) {
  const haptics = usePreferences((state) => state.haptics);
  const biometricLock = usePreferences((state) => state.biometricLock);

  useEffect(() => {
    services.haptics.setEnabled(haptics);
  }, [services, haptics]);

  useEffect(() => {
    const { sync } = services.container;
    sync.start(env.EXPO_PUBLIC_SYNC_INTERVAL_MS);
    const unsubscribe = services.network.subscribe((online) => sync.setOnline(online));
    return () => {
      unsubscribe();
      sync.stop();
    };
  }, [services]);

  useEffect(() => {
    let resumeCheck: ReturnType<typeof setTimeout> | undefined;
    const lockIfBackground = () => {
      const session = useSession.getState();
      if (AppState.currentState === 'background' && !services.nativePrompts.active && biometricLock && session.user) {
        session.signedIn(session.user, { locked: true });
      }
    };
    const subscription = AppState.addEventListener('change', () => {
      clearTimeout(resumeCheck);
      lockIfBackground();
    });
    // A permission dialog is part of the current flow. If the user actually
    // leaves the app during it, lock once the dialog finishes in the background.
    const unsubscribe = services.nativePrompts.onIdle(() => {
      // Android may deliver the permission result just before onResume.
      clearTimeout(resumeCheck);
      resumeCheck = setTimeout(lockIfBackground, 300);
    });
    return () => {
      clearTimeout(resumeCheck);
      subscription.remove();
      unsubscribe();
    };
  }, [biometricLock, services]);

  return null;
}

function ThemedChrome({ children }: PropsWithChildren) {
  const theme = useTheme();
  const navigationTheme = theme.isDark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: { ...navigationTheme.colors, background: theme.colors.background, card: theme.colors.surface, primary: theme.colors.primary, text: theme.colors.text, border: theme.colors.border },
      }}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {children}
        <ToastHost />
      </View>
    </ThemeProvider>
  );
}

/**
 * Application shell: loads fonts, boots the composition root, restores the JWT
 * session and only then hides the splash screen.
 */
export function AppRoot({ boot, children }: AppRootProps) {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  const [services, setServices] = useState<AppServices | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const booted = await boot();
      const restored = await booted.container.useCases.restoreSession.execute();
      if (cancelled) return;
      const user = restored.getOrElse(null);
      if (user) useSession.getState().signedIn(user, { locked: usePreferences.getState().biometricLock });
      else useSession.getState().signedOut();
      setServices(booted);
    })();
    return () => {
      cancelled = true;
    };
  }, [boot]);

  const ready = (fontsLoaded || !!fontError) && services !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ServicesProvider services={services}>
          <Runtime services={services} />
          <ThemedChrome>{children}</ThemedChrome>
        </ServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
