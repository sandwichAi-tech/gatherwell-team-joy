export type PlatformAgreement = { ready: boolean; en_id: string | null; es_id: string | null; en_url: string | null; es_url: string | null; en_version: number | null; es_version: number | null };
export const platformSelection = (a: PlatformAgreement | null | undefined, lang: string) => a?.ready ? { id: lang === 'es' ? a.es_id : a.en_id, url: lang === 'es' ? a.es_url : a.en_url, version: lang === 'es' ? a.es_version : a.en_version } : null;
export const publicHostSlug = (host: { slug?: string | null } | null | undefined) => host?.slug && /^[a-z0-9][a-z0-9-]{0,79}$/.test(host.slug) ? host.slug : null;
export const safeWaiverPdf = (size: number, mime: string, header: string) => size > 0 && size <= 10 * 1024 * 1024 && mime === 'application/pdf' && header.startsWith('%PDF-');
/** Our own legal pages open on the current site (so preview and live show the same stored text); other URLs are used as-is. */
export const agreementViewUrl = (url: string | null | undefined, origin: string) => {
  if (!url) return null;
  try { const u = new URL(url); return /^(www\.)?zoheewell\.com$/.test(u.hostname) && u.pathname.startsWith('/legal/') ? origin + u.pathname + u.search : url; } catch { return null; }
};
