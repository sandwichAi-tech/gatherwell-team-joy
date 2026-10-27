/** Plain text stays plain text; only HTTP(S) links become clickable. */
export function safeChatUrl(value: string): string | null {
  if (/[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function textLinks(body: string): { text: string; href: string | null }[] {
  return body.split(/(https?:\/\/[^\s<>]+)/g).filter(Boolean).map(text => ({ text, href: safeChatUrl(text) }));
}

export type Announcement = {
  id: string; title: string; body: string; link_url: string | null; pinned: boolean;
  created_at: string; updated_at: string | null; archived_at: string | null; author_id: string;
};
export function orderAnnouncements(rows: Announcement[]) {
  return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
export const channelKey = (team: string, user: string) => ['team-channel', team, user] as const;

/** Known legacy rows are active memberships; pending/expired invitations are not memberships. */
export function directChannelEligible(owner: boolean, role: string | null, suspended: boolean) {
  return !suspended && (owner || ['leader', 'host', 'member'].includes(role ?? ''));
}