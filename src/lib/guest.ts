import { supabase } from '@/integrations/supabase/client';
import { COVER_STYLES } from '@/lib/gatherings';

export type PublicEvent = {
  id: string; title: string; description_en: string | null; description_es: string | null;
  cover_url: string | null; cover_style: number | null; starts_at: string; ends_at: string | null; timezone: string;
  location_name: string | null; address: string | null; meeting_note: string | null; lat: number | null; lng: number | null;
  is_online: boolean; has_online: boolean; capacity: number | null; status: 'published' | 'cancelled';
  hide_guest_list: boolean; going: number; initials: string[] | null;
  host: { name: string | null; avatar_url: string | null; verified?: boolean } | null; retreat?: unknown; cohosts?: { name: string | null; avatar_url: string | null }[]; team_name: string | null; my_code: string | null;
  questions?: RsvpQuestion[]; require_approval?: boolean; team_registration?: boolean; team_min?: number; team_max?: number; team_price_mode?: 'person' | 'team'; visibility?: 'public' | 'team' | 'invite';
};

export type RsvpQuestion = { id: string; kind: 'text' | 'choice' | 'yesno'; label: string; options?: string[] | undefined; required?: boolean };

/** Private invite key from the current link (?k=), used for invite-only gatherings. */
export const inviteToken = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('k'));

export type GuestRsvp = {
  id: string; event_id: string; guest_name: string | null; plus_ones: number; status: 'going' | 'maybe' | 'waitlist' | 'cancelled' | 'requested' | 'declined';
  checkin_code: string; checked_in_at: string | null; language: string;
  event: Pick<PublicEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'timezone' | 'location_name' | 'address' | 'meeting_note' | 'lat' | 'lng' | 'cover_url' | 'cover_style' | 'status' | 'capacity' | 'description_en' | 'description_es'> & { online_url: string | null };
};

export const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export const publicEventQuery = (id: string) => ({
  queryKey: ['public-event', id],
  queryFn: async (): Promise<PublicEvent | null> => {
    if (!isUuid(id)) return null;
    const { data, error } = await (supabase as any).rpc('get_public_event_k', { _id: id, _token: inviteToken() });
    if (error) throw error;
    return (data as unknown as PublicEvent) ?? null;
  },
});

export const rsvpByCodeQuery = (code: string) => ({
  queryKey: ['rsvp', code],
  queryFn: async (): Promise<GuestRsvp | null> => {
    const { data, error } = await supabase.rpc('get_rsvp_by_code', { _code: code });
    if (error) throw error;
    return (data as unknown as GuestRsvp) ?? null;
  },
});

type When = Pick<PublicEvent, 'title' | 'starts_at' | 'ends_at' | 'location_name' | 'address'>;
const endOf = (e: When) => e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 3600000);
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const placeText = (e: When) => [e.location_name, e.address].filter(Boolean).join(', ');

export function googleCalendarUrl(e: When, details: string) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(new Date(e.starts_at))}/${stamp(endOf(e))}`, details, location: placeText(e) });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(e: When & { id: string }, details: string) {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gatherwell//EN', 'BEGIN:VEVENT', `UID:${e.id}@gatherwell`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(e.starts_at))}`, `DTEND:${stamp(endOf(e))}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(placeText(e))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'gathering.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Apple Maps on iPhone/iPad, Google Maps elsewhere — no key needed. */
export function directionsUrl(e: Pick<PublicEvent, 'address' | 'location_name' | 'lat' | 'lng'>) {
  const q = e.address || e.location_name || (e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : '');
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return apple ? `https://maps.apple.com/?daddr=${encodeURIComponent(q)}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export const hasPlace = (e: Pick<PublicEvent, 'address' | 'location_name' | 'lat' | 'lng'>) => !!(e.address || e.location_name || (e.lat != null && e.lng != null));

export function formatWhen(iso: string, lang: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-419' : 'en-US', opts).format(new Date(iso));
}

export const guestLink = (id: string, token: string | null = inviteToken()) => `${window.location.origin}/e/${id}${token ? `?k=${encodeURIComponent(token)}` : ''}`;

/** 1080x1920 story image in the premium plum style. */
export async function storyImage(opts: { title: string; date: string; link: string; coverUrl: string | null; coverStyle: number | null; brand: string }) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2F2340'; g.fillRect(0, 0, 1080, 1920);
  const coverH = 1180;
  let drewPhoto = false;
  if (opts.coverUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = opts.coverUrl!; });
      const s = Math.max(1080 / img.width, coverH / img.height);
      g.drawImage(img, (1080 - img.width * s) / 2, (coverH - img.height * s) / 2, img.width * s, img.height * s);
      drewPhoto = true;
    } catch { /* fall back to gradient */ }
  }
  if (!drewPhoto) {
    const stops = ((COVER_STYLES[(opts.coverStyle ?? 0) % COVER_STYLES.length] ?? COVER_STYLES[0]).match(/#[0-9A-F]{6}/gi) ?? ['#2F2340', '#7A5FA8']);
    const grad = g.createLinearGradient(0, 0, 1080, coverH);
    stops.forEach((col, i) => grad.addColorStop(i / Math.max(1, stops.length - 1), col));
    g.fillStyle = grad; g.fillRect(0, 0, 1080, coverH);
  }
  const fade = g.createLinearGradient(0, coverH - 420, 0, coverH);
  fade.addColorStop(0, 'rgba(47,35,64,0)'); fade.addColorStop(1, 'rgba(47,35,64,1)');
  g.fillStyle = fade; g.fillRect(0, coverH - 420, 1080, 420);
  const font = (w: number, s: number) => `${w} ${s}px Inter, system-ui, sans-serif`;
  g.fillStyle = '#F3C6A5'; g.font = font(600, 34); g.fillText(opts.brand.toUpperCase(), 96, 1300);
  g.fillStyle = '#FFFFFF'; g.font = font(700, 92);
  const words = opts.title.split(/\s+/); let line = ''; let y = 1430; const lines: string[] = [];
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > 888 && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.slice(0, 3).forEach(l => { g.fillText(l, 96, y); y += 108; });
  g.fillStyle = '#D2CADA'; g.font = font(500, 44); g.fillText(opts.date, 96, y + 30);
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(96, 1740); g.lineTo(984, 1740); g.stroke();
  g.fillStyle = '#FFFFFF'; g.font = font(500, 38); g.fillText(opts.link.replace(/^https?:\/\//, ''), 96, 1812);
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'gathering-story.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function rsvpErrorKey(error: unknown) {
  const m = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  for (const k of ['name_required', 'contact_required', 'invalid_email', 'not_open', 'too_long', 'rate_limited', 'members_only', 'waiver_required', 'answers_required', 'early_access']) if (m.includes(k)) return `guest.errors.${k}`;
  return 'guest.errors.generic';
}
