/**
 * RFC 5545 calendar file support: single, recurring, and multi-day events,
 * updates/cancellations with stable UIDs, plus Google/Outlook template links.
 * Pure functions — no browser APIs except in downloadIcsFile.
 */

export type IcsEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  status?: 'confirmed' | 'cancelled';
  /** 'weekly' adds an RRULE; anything else is a single event. */
  recurrence?: string | null;
  /** Multi-day retreat itinerary entries, shown inside the description. */
  itinerary?: { label: string; time?: string | null }[] | null;
  /** Bump on updates so calendar apps refresh the entry. */
  sequence?: number;
};

export const icsEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 §3.1: content lines fold at 75 octets with a leading space. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

/** UTC basic-format timestamp, e.g. 20261024T173000Z. */
export const icsStamp = (iso: string | Date) =>
  (typeof iso === 'string' ? new Date(iso) : iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const endOf = (e: Pick<IcsEvent, 'startsAt' | 'endsAt'>) =>
  e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 3600000).toISOString();

export function buildVEvent(e: IcsEvent, dtstamp: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@zoheewell`);
  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(`DTSTART:${icsStamp(e.startsAt)}`);
  lines.push(`DTEND:${icsStamp(endOf(e))}`);
  lines.push(icsFold(`SUMMARY:${icsEscape(e.title)}`));
  const descParts: string[] = [];
  if (e.description) descParts.push(e.description);
  if (e.itinerary?.length) {
    descParts.push(e.itinerary.map(d => (d.time ? `${d.time} — ${d.label}` : d.label)).join('\n'));
  }
  if (e.url) descParts.push(e.url);
  if (descParts.length) lines.push(icsFold(`DESCRIPTION:${icsEscape(descParts.join('\n\n'))}`));
  if (e.location) lines.push(icsFold(`LOCATION:${icsEscape(e.location)}`));
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.recurrence === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
  lines.push(`SEQUENCE:${e.sequence ?? 0}`);
  lines.push(`STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
  lines.push('END:VEVENT');
  return lines;
}

/** Full VCALENDAR document for one event (stable UID across updates/cancellations). */
export function buildIcs(e: IcsEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZoheeWell//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...buildVEvent(e, icsStamp(now)),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${icsStamp(e.startsAt)}/${icsStamp(endOf(e))}`,
    ...(e.description ? { details: e.description } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.recurrence === 'weekly' ? { recur: 'RRULE:FREQ=WEEKLY' } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: new Date(e.startsAt).toISOString(),
    enddt: new Date(endOf(e)).toISOString(),
    ...(e.description ? { body: e.description } : {}),
    ...(e.location ? { location: e.location } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

/** Browser-side .ics download (Apple Calendar and any calendar app). */
export function downloadIcsFile(e: IcsEvent, filename = 'event.ics'): void {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
