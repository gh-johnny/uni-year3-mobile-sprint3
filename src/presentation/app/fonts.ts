import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';

import { fontFamily } from '../design-system/tokens/tokens';

/** Font files keyed by the family names the typography tokens reference. */
export const FONT_MAP = {
  [fontFamily.body]: Barlow_400Regular,
  [fontFamily.bodyMedium]: Barlow_500Medium,
  [fontFamily.bodySemiBold]: Barlow_600SemiBold,
  [fontFamily.displayMedium]: BarlowCondensed_500Medium,
  [fontFamily.display]: BarlowCondensed_600SemiBold,
  [fontFamily.displayBold]: BarlowCondensed_700Bold,
  [fontFamily.mono]: JetBrainsMono_500Medium,
};
