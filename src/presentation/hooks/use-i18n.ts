import { useMemo } from 'react';

import { Formatters, Locale, resolveLocale, Translator } from '../i18n';
import { usePreferences } from '../state/preferences-store';

export type I18n = { locale: Locale; t: Translator['t']; translator: Translator; f: Formatters };

export function useI18n(): I18n {
  const preference = usePreferences((state) => state.locale);
  const locale = useMemo(() => resolveLocale(preference), [preference]);
  return useMemo(() => {
    const translator = Translator.for(locale);
    return { locale, translator, t: translator.t.bind(translator), f: Formatters.for(locale) };
  }, [locale]);
}
