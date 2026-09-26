/**
 * Raw palette — never used directly by components (they consume semantic theme
 * tokens). Anchored on Ford Blue, with a single warm accent borrowed from the
 * Raptor's "Code Orange" and a blue-tinted neutral ramp.
 */
export const palette = {
  fordBlue: '#00095B',
  blue600: '#0450C2',
  blue500: '#066FEF',
  blue400: '#3D8BFF',
  blue300: '#7FB1FF',
  blue100: '#E1ECFF',
  blue950: '#0A1A4A',

  orange600: '#E54A0E',
  orange500: '#FF5F1F',
  orange400: '#FF7D47',
  orange100: '#FFE8DE',
  orange950: '#3A1606',

  green600: '#0E8A44',
  green500: '#12A150',
  green400: '#34D17D',
  green100: '#DDF5E7',
  green950: '#07301B',

  amber600: '#C98500',
  amber500: '#E8A10C',
  amber400: '#FFC247',
  amber100: '#FFF2D3',
  amber950: '#3A2A04',

  red600: '#C92A2D',
  red500: '#E5383B',
  red400: '#FF6467',
  red100: '#FFE1E1',
  red950: '#3D0B0C',

  white: '#FFFFFF',
  ink50: '#F3F4F8',
  ink100: '#E9EBF2',
  ink200: '#DCE0EA',
  ink300: '#C2C8D8',
  ink400: '#8E96B0',
  ink500: '#646D8A',
  ink600: '#454D6A',
  ink700: '#232A4D',
  ink800: '#161C3C',
  ink850: '#10153099',
  ink900: '#0D1130',
  ink950: '#05071A',
  black: '#000000',
} as const;

export type PaletteColor = keyof typeof palette;
