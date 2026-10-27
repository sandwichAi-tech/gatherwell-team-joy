import type { Destinations } from '@/lib/resource-placement';

/** Live places a resource currently appears, in display order. Course titles use the reader's language. */
export function livePlacementNames(dest: Destinations | null, lang: 'en' | 'es', labels: { team: string; coach: string }): string[] {
  if (!dest) return [];
  const out: string[] = [];
  if (dest.team) out.push(labels.team);
  if (dest.coach) out.push(labels.coach);
  for (const c of dest.courses) {
    const x = c as { title_en?: string; title_es?: string };
    const title = (lang === 'es' ? x.title_es || x.title_en : x.title_en || x.title_es) || '';
    if (title.trim()) out.push(title.trim());
  }
  return out;
}
