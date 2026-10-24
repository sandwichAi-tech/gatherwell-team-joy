// Host analytics shaping helpers. Pure functions; the server RPCs re-check authorization.
import { toCsv } from './csv';

export type HostEventStat = {
  id: string; title: string; starts_at: string | null; status: string;
  going: number; attended: number; waitlist: number; cancelled: number;
};

export type HostOfferStat = {
  id: string; title: string; kind: string; status: string;
  enrollments: number; learners_started: number; certificates: number;
};

export type HostSales = { orders: number; gross_cents: number; platform_fee_cents: number; net_cents: number };

export type HostAnalytics = { events: HostEventStat[]; offers: HostOfferStat[]; sales: HostSales };

export type TeamAnalytics = {
  members: number; events: number; events_30d: number; registrations: number;
  attended: number; offers: number; enrollments: number;
};

/** Attendance rate 0–100 for one event, or null when nobody registered (avoids a fake 0%). */
export function attendanceRate(e: Pick<HostEventStat, 'going' | 'attended'>): number | null {
  if (e.going <= 0) return null;
  return Math.round((e.attended / e.going) * 100);
}

export function totals(events: HostEventStat[]): { going: number; attended: number; waitlist: number; cancelled: number } {
  return events.reduce(
    (acc, e) => ({ going: acc.going + e.going, attended: acc.attended + e.attended, waitlist: acc.waitlist + e.waitlist, cancelled: acc.cancelled + e.cancelled }),
    { going: 0, attended: 0, waitlist: 0, cancelled: 0 },
  );
}

/** Aggregate-only CSV: one row per event, no guest names or contacts. */
export function eventsCsv(events: HostEventStat[]): string {
  return toCsv(
    ['event', 'starts_at', 'status', 'registered', 'attended', 'waitlisted', 'cancelled'],
    events.map(e => [e.title, e.starts_at ?? '', e.status, e.going, e.attended, e.waitlist, e.cancelled]),
  );
}

export function offersCsv(offers: HostOfferStat[]): string {
  return toCsv(
    ['offering', 'kind', 'status', 'enrollments', 'learners_started', 'certificates'],
    offers.map(o => [o.title, o.kind, o.status, o.enrollments, o.learners_started, o.certificates]),
  );
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
