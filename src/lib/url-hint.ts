/** Plain-language link feedback: what customers will open, or what is wrong. */
export function urlHint(raw: string): { key: 'urlEmpty' | 'urlHttps' | 'urlOpens' | 'urlInvalid'; host?: string } {
  const v = raw.trim(); if (!v) return { key: 'urlEmpty' };
  try { const u = new URL(v); if (u.protocol === 'http:') return { key: 'urlHttps' }; if (u.protocol !== 'https:') return { key: 'urlInvalid' }; return { key: 'urlOpens', host: u.hostname.replace(/^www\./, '') }; }
  catch { return { key: 'urlInvalid' }; }
}
