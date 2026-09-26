import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalePreference } from '../i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

type PreferencesState = {
  theme: ThemePreference;
  locale: LocalePreference;
  haptics: boolean;
  biometricLock: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: LocalePreference) => void;
  setHaptics: (enabled: boolean) => void;
  setBiometricLock: (enabled: boolean) => void;
};

export const DEFAULT_PREFERENCES = { theme: 'system', locale: 'system', haptics: true, biometricLock: false } as const;

/** UI preferences, persisted locally in SQLite's key-value store (local-first). */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setHaptics: (haptics) => set({ haptics }),
      setBiometricLock: (biometricLock) => set({ biometricLock }),
    }),
    {
      name: 'pitlane.preferences',
      storage: createJSONStorage(() => Storage),
      partialize: ({ theme, locale, haptics, biometricLock }) => ({ theme, locale, haptics, biometricLock }),
    },
  ),
);
