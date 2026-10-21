import en from './en';
import zh, { type Dict } from './zh';

export type Locale = 'zh' | 'en';
export type { Dict };

const dicts: Record<Locale, Dict> = { zh, en };

export function getDict(locale: Locale): Dict {
  return dicts[locale];
}

export function localeFromUrl(url: URL): Locale {
  return url.pathname.startsWith('/en') ? 'en' : 'zh';
}

/** Home path for a locale; the default locale lives at the root. */
export function homePath(locale: Locale): string {
  return locale === 'en' ? '/en/' : '/';
}

export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}
