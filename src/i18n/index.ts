import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './en';
import { ko } from './ko';

/**
 * Korean-primary, English-fallback, selected by device locale (no in-app
 * switcher — spec §3). Exported instance lets tests flip locale explicitly.
 */
export const i18n = new I18n({ en, ko });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? 'en';

export const t = i18n.t.bind(i18n);
