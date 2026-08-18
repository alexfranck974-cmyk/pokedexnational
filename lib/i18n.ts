import type { Locale } from './locale';

export function getName(p: { name_fr: string | null; name_en: string }, locale: Locale = 'fr'): string {
  if (locale === 'en') return p.name_en;
  return p.name_fr ?? p.name_en;
}
