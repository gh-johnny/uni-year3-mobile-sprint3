import { TextStyle } from 'react-native';

/** 4-pt spacing grid. */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 4,
  md: 6,
  lg: 10,
  xl: 28,
  pill: 999,
} as const;

/** Font families are the keys registered with `useFonts` in `FontGate`. */
export const fontFamily = {
  body: 'IBMPlexSans-Regular',
  bodyMedium: 'IBMPlexSans-Medium',
  bodySemiBold: 'IBMPlexSans-SemiBold',
  display: 'ArchivoBlack-Regular',
  displayBold: 'ArchivoBlack-Regular',
  displayMedium: 'IBMPlexSans-Medium',
  mono: 'JetBrainsMono-Medium',
} as const;

/**
 * Wide, heavy display type gives the product its track-poster character.
 * Plex handles controls and reading; mono is reserved for telemetry and IDs.
 */
export const typography = {
  hero: { fontFamily: fontFamily.display, fontSize: 48, lineHeight: 50, letterSpacing: -2, textTransform: 'uppercase' },
  display: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 34, letterSpacing: -1.2, textTransform: 'uppercase' },
  title1: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  title2: { fontFamily: fontFamily.displayMedium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  title3: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamily.bodySemiBold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fontFamily.mono, fontSize: 10, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase' },
  metric: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: fontFamily.mono, fontSize: 13, lineHeight: 20, letterSpacing: 0 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Motion language: quick, damped springs — a pit stop, not a bounce house. */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springGentle: { damping: 20, stiffness: 120, mass: 1 },
  springSnappy: { damping: 16, stiffness: 380, mass: 0.7 },
  duration: { fast: 160, base: 260, slow: 520, gauge: 1100 },
  pressScale: 0.965,
} as const;

export const layout = {
  tabBarHeight: 68,
  tabBarBottomGap: 12,
  screenPadding: space.xl,
  maxContentWidth: 640,
} as const;
