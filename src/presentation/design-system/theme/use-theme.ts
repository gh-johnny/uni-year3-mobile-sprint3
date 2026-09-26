import { StyleSheet, useColorScheme } from 'react-native';

import { usePreferences } from '../../state/preferences-store';
import { ColorScheme, Theme } from './theme';

export function useColorSchemeResolved(): ColorScheme {
  const preference = usePreferences((state) => state.theme);
  const system = useColorScheme();
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  return Theme.for(useColorSchemeResolved());
}

/**
 * Theme-aware StyleSheet factory. Styles are created once per theme and cached,
 * so switching light/dark is instant and renders stay allocation-free.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): () => T {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
