import { createContext, PropsWithChildren, useContext } from 'react';

import type { AppContainer } from '@/infrastructure/container';
import type { BiometricService } from '@/infrastructure/platform/biometrics';
import type { HapticsService } from '@/infrastructure/platform/haptics';
import type { HeadingSource } from '@/infrastructure/platform/location';
import type { NetworkMonitor } from '@/infrastructure/platform/network';
import type { NativePrompts } from '@/infrastructure/platform/native-prompts';

export type AppServices = {
  container: AppContainer;
  haptics: HapticsService;
  biometrics: BiometricService;
  heading: HeadingSource;
  network: NetworkMonitor;
  nativePrompts: NativePrompts;
};

const ServicesContext = createContext<AppServices | null>(null);

/** Dependency injection for React: screens receive services, never construct them. */
export function ServicesProvider({ services, children }: PropsWithChildren<{ services: AppServices }>) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices() must be used inside <ServicesProvider>');
  return services;
}

export const useUseCases = () => useServices().container.useCases;
export const useHaptics = () => useServices().haptics;
