/** Website embed for a coach's public page. The iframe points at the live /embed/h/<slug> route, so page edits appear without re-copying. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export function embedUrl(origin: string, slug: string): string | null {
  return SLUG.test(slug) ? `${origin.replace(/\/$/, '')}/embed/h/${slug}` : null;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function embedSnippet(origin: string, slug: string, title: string): string | null {
  const src = embedUrl(origin, slug); if (!src) return null;
  const page = `${origin.replace(/\/$/, '')}/h/${slug}`;
  return `<iframe src="${esc(src)}" title="${esc(title)}" width="100%" height="720" style="border:0;max-width:720px;width:100%" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>\n<p><a href="${esc(page)}" target="_blank" rel="noopener">${esc(title)} · ZoheeWell</a></p>`;
}
