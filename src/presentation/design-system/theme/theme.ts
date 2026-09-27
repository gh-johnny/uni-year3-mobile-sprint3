import { palette } from '../tokens/palette';
import { layout, motion, radius, space, typography } from '../tokens/tokens';

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  surfaceInverse: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  brand: string;
  onBrand: string;
  signal: string;
  onSignal: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  onAccentSoft: string;
  success: string;
  successSoft: string;
  onSuccessSoft: string;
  warning: string;
  warningSoft: string;
  onWarningSoft: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;
  overlay: string;
  shadow: string;
  chart: readonly string[];
};

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

const light: ThemeColors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceMuted: palette.ink100,
  surfaceRaised: palette.white,
  surfaceInverse: palette.ink950,
  border: palette.ink200,
  borderStrong: palette.ink300,
  text: palette.ink900,
  textMuted: palette.ink500,
  textSubtle: palette.ink500,
  textInverse: palette.white,
  brand: palette.fordBlue,
  onBrand: palette.white,
  signal: palette.blue400,
  onSignal: palette.fordBlue,
  primary: palette.blue600,
  primaryPressed: palette.fordBlue,
  onPrimary: palette.white,
  primarySoft: palette.blue100,
  onPrimarySoft: palette.fordBlue,
  accent: palette.blue600,
  onAccent: palette.white,
  accentSoft: palette.blue100,
  onAccentSoft: palette.blue600,
  success: palette.green500,
  successSoft: palette.green100,
  onSuccessSoft: palette.green600,
  warning: palette.amber500,
  warningSoft: palette.amber100,
  onWarningSoft: palette.amber600,
  danger: palette.red500,
  dangerSoft: palette.red100,
  onDangerSoft: palette.red600,
  overlay: 'rgba(6, 13, 36, 0.45)',
  shadow: 'rgba(6, 13, 36, 0.06)',
  chart: [palette.blue600, palette.green500, palette.orange500, palette.amber500, palette.ink600, palette.red500],
};

const dark: ThemeColors = {
  background: palette.ink950,
  surface: palette.ink900,
  surfaceMuted: palette.ink800,
  surfaceRaised: palette.ink800,
  surfaceInverse: palette.white,
  border: palette.ink700,
  borderStrong: palette.ink600,
  text: palette.white,
  textMuted: palette.ink400,
  textSubtle: palette.ink400,
  textInverse: palette.ink950,
  brand: palette.fordBlue,
  onBrand: palette.white,
  signal: palette.blue400,
  onSignal: palette.fordBlue,
  primary: palette.blue400,
  primaryPressed: palette.blue100,
  onPrimary: palette.fordBlue,
  primarySoft: palette.blue950,
  onPrimarySoft: palette.blue400,
  accent: palette.blue400,
  onAccent: palette.ink950,
  accentSoft: palette.blue950,
  onAccentSoft: palette.blue400,
  success: palette.green400,
  successSoft: palette.green950,
  onSuccessSoft: palette.green400,
  warning: palette.amber400,
  warningSoft: palette.amber950,
  onWarningSoft: palette.amber400,
  danger: palette.red400,
  dangerSoft: palette.red950,
  onDangerSoft: palette.red400,
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.5)',
  chart: [palette.blue400, palette.orange400, palette.green400, palette.amber400, palette.ink400, palette.red400],
};

/** A complete, immutable theme. `Theme.for(scheme)` is the only way to build one. */
export class Theme {
  private static readonly cache = new Map<ColorScheme, Theme>();

  readonly space = space;
  readonly radius = radius;
  readonly typography = typography;
  readonly motion = motion;
  readonly layout = layout;

  private constructor(
    readonly scheme: ColorScheme,
    readonly colors: ThemeColors,
  ) {}

  static for(scheme: ColorScheme): Theme {
    const cached = Theme.cache.get(scheme);
    if (cached) return cached;
    const theme = new Theme(scheme, scheme === 'dark' ? dark : light);
    Theme.cache.set(scheme, theme);
    return theme;
  }

  get isDark(): boolean {
    return this.scheme === 'dark';
  }

  /** Foreground/background pair for a semantic tone (badges, banners, icons). */
  tone(tone: Tone): { solid: string; soft: string; onSoft: string } {
    const { colors } = this;
    switch (tone) {
      case 'primary':
        return { solid: colors.primary, soft: colors.primarySoft, onSoft: colors.onPrimarySoft };
      case 'accent':
        return { solid: colors.accent, soft: colors.accentSoft, onSoft: colors.onAccentSoft };
      case 'success':
        return { solid: colors.success, soft: colors.successSoft, onSoft: colors.onSuccessSoft };
      case 'warning':
        return { solid: colors.warning, soft: colors.warningSoft, onSoft: colors.onWarningSoft };
      case 'danger':
        return { solid: colors.danger, soft: colors.dangerSoft, onSoft: colors.onDangerSoft };
      default:
        return { solid: colors.textMuted, soft: colors.surfaceMuted, onSoft: colors.text };
    }
  }
}
