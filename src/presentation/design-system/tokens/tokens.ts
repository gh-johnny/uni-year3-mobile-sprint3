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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Font families are the keys registered with `useFonts` in `FontGate`. */
export const fontFamily = {
  body: 'Barlow-Regular',
  bodyMedium: 'Barlow-Medium',
  bodySemiBold: 'Barlow-SemiBold',
  display: 'BarlowCondensed-SemiBold',
  displayBold: 'BarlowCondensed-Bold',
  displayMedium: 'BarlowCondensed-Medium',
  mono: 'JetBrainsMono-Medium',
} as const;

/**
 * Type scale. Display styles use the condensed family — the look of timing
 * screens and instrument clusters — while body copy stays in regular Barlow.
 */
export const typography = {
  hero: { fontFamily: fontFamily.displayBold, fontSize: 56, lineHeight: 56, letterSpacing: -0.5 },
  display: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.3 },
  title1: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 34 },
  title2: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 28 },
  title3: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamily.bodySemiBold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fontFamily.displayMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: 'uppercase' },
  metric: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  mono: { fontFamily: fontFamily.mono, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 },
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
  tabBarHeight: 64,
  tabBarBottomGap: 12,
  screenPadding: space.xl,
  maxContentWidth: 640,
} as const;
