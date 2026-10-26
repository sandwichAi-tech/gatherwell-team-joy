// Stored in-app links (notifications, messages) may carry a query string, e.g. "/team?topic=<id>".
// The router needs path and search separately; a "?" inside `to` produces a dead page.
export type AppLink = { to: string; search: Record<string, string> };

export function splitAppLink(link: string | null | undefined): AppLink | null {
  const raw = (link ?? '').trim();
  // Internal paths only: one leading slash, never protocol-relative or absolute URLs.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  const [beforeHash] = raw.split('#');
  const i = beforeHash!.indexOf('?');
  const to = i === -1 ? beforeHash! : beforeHash!.slice(0, i);
  const search: Record<string, string> = {};
  if (i !== -1) new URLSearchParams(beforeHash!.slice(i + 1)).forEach((v, k) => { search[k] = v; });
  return { to: to || '/', search };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A team discussion deep link is only honoured for a well-formed id. */
export const validTopicId = (v: unknown): string | undefined => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : undefined);
