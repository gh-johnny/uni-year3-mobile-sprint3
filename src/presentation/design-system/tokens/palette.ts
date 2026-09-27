/**
 * Raw palette — never used directly by components (they consume semantic theme
 * tokens). Ford navy, electric blue and cool neutral surfaces, with
 * separate colours for success, warning and danger states.
 */
export const palette = {
  fordBlue: '#00095B',
  blue600: '#0046B8',
  blue500: '#005BEA',
  blue400: '#65B5FF',
  blue300: '#ACD4FF',
  blue100: '#E5F0FF',
  blue950: '#142E57',

  orange600: '#9D421E',
  orange500: '#B95127',
  orange400: '#F6A079',
  orange100: '#F3E9E1',
  orange950: '#342A24',

  green600: '#2E654E',
  green500: '#37745B',
  green400: '#93C2A8',
  green100: '#E7EFE9',
  green950: '#23332B',

  amber600: '#815B20',
  amber500: '#916622',
  amber400: '#D8BD81',
  amber100: '#F2EDDF',
  amber950: '#332F23',

  red600: '#953F3A',
  red500: '#AF4943',
  red400: '#E3A19C',
  red100: '#F5E8E6',
  red950: '#382727',

  white: '#FCFDFF',
  ink50: '#F1F5FC',
  ink100: '#E3EAF5',
  ink200: '#CDD8E9',
  ink300: '#A5B5CF',
  ink400: '#A7B8D2',
  ink500: '#566882',
  ink600: '#3E5274',
  ink700: '#293D60',
  ink800: '#1A2B4B',
  ink850: '#14244099',
  ink900: '#101E3C',
  ink950: '#060D24',
  black: '#000000',
} as const;

export type PaletteColor = keyof typeof palette;
