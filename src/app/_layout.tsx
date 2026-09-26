import { Stack } from 'expo-router';

import { AppRoot } from '@/presentation/app/app-root';
import { bootstrap } from '@/presentation/app/bootstrap';
import { useTheme } from '@/presentation/design-system';
import { useSession } from '@/presentation/state/session-store';

const sheet = (detents: number[]) =>
  ({
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
  }) as const;

export function RootNavigator() {
  const theme = useTheme();
  const { status, user, locked } = useSession();
  const active = status === 'signedIn' && !locked;
  const role = user?.role.key;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!active}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={active && role === 'owner'}>
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="booking" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pass/[id]" options={sheet([0.82, 1])} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={active && role === 'advisor'}>
        <Stack.Screen name="(advisor)" />
        <Stack.Screen name="lead/[vehicleId]" options={sheet([0.7, 1])} />
      </Stack.Protected>
      <Stack.Protected guard={active}>
        <Stack.Screen name="vehicle/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="sync" options={sheet([0.75, 1])} />
        <Stack.Screen name="design-system" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppRoot boot={bootstrap}>
      <RootNavigator />
    </AppRoot>
  );
}
