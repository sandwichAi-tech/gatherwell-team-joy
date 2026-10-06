import { createFileRoute } from '@tanstack/react-router';
import { APP_URL } from '@/lib/notify/templates.server';

type Row = { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; online: boolean; status: string; role: string; updated: string };
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** RFC 5545 lines must be folded at 75 octets. */
const fold = (line: string) => { const out: string[] = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); } out.push(rest); return out.join('\r\n'); };

/** Private iCal feed: the unguessable token in the URL is the only credential. */
export const Route = createFileRoute('/api/public/calendar/$token')({
  server: { handlers: { GET: async ({ params }) => {
    const token = params.token.replace(/\.ics$/i, '');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Not found', { status: 404 });
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return new Response('Unavailable', { status: 503 });
    const res = await fetch(`${url}/rest/v1/rpc/calendar_feed`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: token }) });
    if (!res.ok) return new Response('Unavailable', { status: 503 });
    const rows = (await res.json()) as Row[];
    const now = stamp(new Date().toISOString());
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gatherwell//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Gatherwell', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    for (const r of rows) {
      const end = r.ends_at ?? new Date(new Date(r.starts_at).getTime() + 3600000).toISOString();
      lines.push('BEGIN:VEVENT', `UID:${r.id}@gatherwell`, `DTSTAMP:${now}`, `DTSTART:${stamp(r.starts_at)}`, `DTEND:${stamp(end)}`, fold(`SUMMARY:${esc(r.title)}`), `URL:${APP_URL}/event/${r.id}`, fold(`DESCRIPTION:${esc(`${APP_URL}/event/${r.id}`)}`), `STATUS:${r.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
      if (r.location) lines.push(fold(`LOCATION:${esc(r.location)}`)); else if (r.online) lines.push('LOCATION:Online');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return new Response(lines.join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="gatherwell.ics"' } });
  } } },
});
