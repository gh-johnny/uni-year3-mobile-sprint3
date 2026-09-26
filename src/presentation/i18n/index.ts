import { getLocales } from 'expo-localization';

import { en } from './dictionaries/en';
import { ptBR } from './dictionaries/pt-br';
import { Locale, Translator } from './translator';

Translator.register('en', en);
Translator.register('pt-BR', ptBR);

export type LocalePreference = Locale | 'system';

/** Portuguese devices get pt-BR, everyone else English. */
export function deviceLocale(): Locale {
  try {
    return getLocales()[0]?.languageCode === 'pt' ? 'pt-BR' : 'en';
  } catch {
    return 'en';
  }
}

export function resolveLocale(preference: LocalePreference): Locale {
  return preference === 'system' ? deviceLocale() : preference;
}

export { Formatters } from './formatters';
export { LOCALES, Translator } from './translator';
export type { Locale, TranslationKey, TranslationParams } from './translator';
