export function getName(p: { name_fr: string | null; name_en: string }): string {
  return p.name_fr ?? p.name_en;
}
