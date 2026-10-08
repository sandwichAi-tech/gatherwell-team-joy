// Group chat links: platform detection (mirrors public.chat_platform in the database) and share helpers.
export const CHAT_PLATFORMS = ['whatsapp', 'telegram', 'signal', 'groupme', 'messenger', 'discord'] as const;
export type ChatPlatform = (typeof CHAT_PLATFORMS)[number];
export type ChatLink = { url: string };

const PATTERNS: [ChatPlatform, RegExp][] = [
  ['whatsapp', /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/],
  ['telegram', /^https:\/\/(t\.me|telegram\.me)\/(\+|joinchat\/)?[A-Za-z0-9_-]{4,64}$/],
  ['signal', /^https:\/\/signal\.group\/#[A-Za-z0-9_-]{10,200}$/],
  ['groupme', /^https:\/\/(web\.)?groupme\.com\/join_group\/[0-9]+\/[A-Za-z0-9]+$/],
  ['messenger', /^https:\/\/(m\.me\/j\/[A-Za-z0-9_-]{6,64}|(www\.)?messenger\.com\/[A-Za-z0-9_/-]{4,100})$/],
  ['discord', /^https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\/[A-Za-z0-9-]{2,40}$/],
];

export function detectChatPlatform(url: string): ChatPlatform | null {
  const u = url.trim();
  for (const [p, re] of PATTERNS) if (re.test(u)) return p;
  return null;
}

export const CHAT_LABEL: Record<ChatPlatform, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram', signal: 'Signal', groupme: 'GroupMe', messenger: 'Messenger', discord: 'Discord' };

export function readChatLinks(row: { chat_links?: unknown; whatsapp_url?: string | null } | null | undefined): ChatLink[] {
  const list = Array.isArray(row?.chat_links) ? (row!.chat_links as ChatLink[]).filter(l => l && typeof l.url === 'string') : [];
  if (!list.length && row?.whatsapp_url) return [{ url: row.whatsapp_url }];
  return list;
}

export const waShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const tgShare = (text: string, url?: string) => `https://t.me/share/url?url=${encodeURIComponent(url ?? text)}${url ? `&text=${encodeURIComponent(text)}` : ''}`;
