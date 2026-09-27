import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DEMO_ACCOUNTS } from '@/presentation/features/auth/sign-in-form';
import type { RoleKey } from '@/domain/auth/role';
import type { User } from '@/domain/auth/user';
import { BiometricAvailability, BiometricService } from '@/infrastructure/platform/biometrics';
import { HapticsService } from '@/infrastructure/platform/haptics';
import type { HeadingSource } from '@/infrastructure/platform/location';
import { NetworkMonitor } from '@/infrastructure/platform/network';
import { NativePrompts } from '@/infrastructure/platform/native-prompts';
import type { I18n } from '@/presentation/hooks/use-i18n';
import { Formatters, Locale, Translator } from '@/presentation/i18n';
import { AppServices, ServicesProvider } from '@/presentation/providers/services';
import { DEFAULT_PREFERENCES, usePreferences } from '@/presentation/state/preferences-store';
import { useSession } from '@/presentation/state/session-store';
import { useToasts } from '@/presentation/state/toast-store';

import { createTestContainer, TestContainer } from './infrastructure';

export class FakeBiometrics extends BiometricService {
  available: BiometricAvailability = 'available';
  authenticated = true;

  override async availability(): Promise<BiometricAvailability> {
    return this.available;
  }

  override async authenticate(): Promise<boolean> {
    return this.authenticated;
  }
}

/** Compass stand-in: tests push headings with `emit()`. */
export class FakeHeading implements HeadingSource {
  private listener: ((degrees: number) => void) | null = null;
  stops = 0;

  async watch(listener: (degrees: number) => void): Promise<() => void> {
    this.listener = listener;
    return () => {
      this.stops += 1;
      this.listener = null;
    };
  }

  emit(degrees: number): void {
    this.listener?.(degrees);
  }
}

export class FakeNetwork extends NetworkMonitor {
  private listener: ((online: boolean) => void) | null = null;

  override subscribe(listener: (online: boolean) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  emit(online: boolean): void {
    this.listener?.(online);
  }
}

export type TestServices = AppServices & {
  test: TestContainer;
  biometrics: FakeBiometrics;
  heading: FakeHeading;
  network: FakeNetwork;
};

/** Real composition root on in-memory SQLite (sql.js) with fakes for the device-only adapters. */
export async function createTestServices(options: Parameters<typeof createTestContainer>[0] = {}): Promise<TestServices> {
  const test = await createTestContainer(options);
  useSession.setState({ status: 'signedOut', user: null, locked: false });
  usePreferences.setState({ ...DEFAULT_PREFERENCES, locale: 'en', theme: 'light' });
  useToasts.setState({ toasts: [] });
  return {
    test,
    container: test.container,
    haptics: new HapticsService(),
    biometrics: new FakeBiometrics(),
    heading: new FakeHeading(),
    network: new FakeNetwork(),
    nativePrompts: new NativePrompts(),
  };
}

/** Signs in the seeded demo account of a persona (Ana = owner, Carlos = advisor) and starts a session. */
export async function signInAs(services: TestServices, role: RoleKey): Promise<User> {
  const result = await services.container.useCases.signIn.execute(DEMO_ACCOUNTS[role]);
  if (result.isFail()) throw new Error(`could not sign in as ${role}: ${result.error.code}`);
  useSession.getState().signedIn(result.value);
  return result.value;
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

/** Renders a screen inside the same providers the app shell provides. */
export function renderWithServices(ui: ReactElement, services: TestServices) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ServicesProvider services={services}>{ui}</ServicesProvider>
    </SafeAreaProvider>,
  );
}

/** An `I18n` bundle without React — for presenter tests. */
export function i18nFor(locale: Locale): I18n {
  const translator = Translator.for(locale);
  return { locale, translator, t: translator.t.bind(translator), f: Formatters.for(locale) };
}
