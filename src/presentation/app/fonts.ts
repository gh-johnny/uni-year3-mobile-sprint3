import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';

import { fontFamily } from '../design-system/tokens/tokens';

/** Font files keyed by the family names the typography tokens reference. */
export const FONT_MAP = {
  [fontFamily.display]: ArchivoBlack_400Regular,
  [fontFamily.body]: IBMPlexSans_400Regular,
  [fontFamily.bodyMedium]: IBMPlexSans_500Medium,
  [fontFamily.bodySemiBold]: IBMPlexSans_600SemiBold,
  [fontFamily.mono]: JetBrainsMono_500Medium,
};
