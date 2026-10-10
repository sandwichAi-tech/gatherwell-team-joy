/** Day-60 founding scoreboard: pure evaluation of raw counts from admin_day60(). */
export type Day60Coach = { id: string; name: string; language: string; small_town: boolean; stay: boolean | null; live: boolean; minutes_to_live: number | null; gatherings: number; paying: number; first_paid_days: number | null; top_circle_paying: number };
export type Day60Raw = { start_date: string | null; coaches?: Day60Coach[]; spanish_circles_15?: number; paying_members?: number; month1_members?: number; month1_retained?: number; in_person_members?: number; rsvps?: number; checked_in?: number };
export type Day60Target = { key: string; met: boolean; value: string; params: Record<string, string | number> };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function dayCount(start: string, now = new Date()) {
  const d = Math.floor((now.getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000) + 1;
  return Math.max(0, Math.min(60, d));
}

export function verdict(met: number): 'go' | 'adjust' | 'rethink' { return met >= 7 ? 'go' : met >= 4 ? 'adjust' : 'rethink'; }

export function evaluateDay60(r: Day60Raw): Day60Target[] {
  const cs = r.coaches ?? []; const live = cs.filter(c => c.live);
  const med = median(live.map(c => c.minutes_to_live ?? 0));
  const held = live.filter(c => c.gatherings >= 4).length;
  const firstPaid = cs.filter(c => c.first_paid_days != null && c.first_paid_days <= 14).length;
  const small = cs.filter(c => c.small_town); const smallOk = small.filter(c => c.paying >= 10).length;
  const stay = cs.filter(c => c.stay === true).length;
  const paying = r.paying_members ?? 0;
  const ret = pct(r.month1_retained ?? 0, r.month1_members ?? 0);
  const inPerson = pct(r.in_person_members ?? 0, paying);
  const checkin = pct(r.checked_in ?? 0, r.rsvps ?? 0);
  return [
    { key: 'live', met: live.length >= 5 && med != null && med < 60, value: `${live.length}/6`, params: { n: live.length, min: med == null ? '—' : Math.round(med) } },
    { key: 'gatherings', met: live.length > 0 && held === live.length, value: `${held}/${live.length}`, params: { n: held, of: live.length } },
    { key: 'paying', met: paying >= 150, value: `${paying}/150`, params: { n: paying } },
    { key: 'firstPaid', met: firstPaid >= 5, value: `${firstPaid}/6`, params: { n: firstPaid } },
    { key: 'retention', met: (r.month1_members ?? 0) > 0 && ret >= 80, value: `${ret}%`, params: { n: ret, of: r.month1_members ?? 0 } },
    { key: 'inPerson', met: paying > 0 && inPerson >= 40, value: `${inPerson}%`, params: { n: inPerson } },
    { key: 'spanish', met: (r.spanish_circles_15 ?? 0) >= 2, value: `${r.spanish_circles_15 ?? 0}/2`, params: { n: r.spanish_circles_15 ?? 0 } },
    { key: 'smallTown', met: small.length >= 2 && smallOk === small.length, value: `${smallOk}/${Math.max(2, small.length)}`, params: { n: smallOk, of: small.length } },
    { key: 'checkin', met: (r.rsvps ?? 0) > 0 && checkin >= 60, value: `${checkin}%`, params: { n: checkin } },
    { key: 'stay', met: stay >= 4, value: `${stay}/6`, params: { n: stay } },
  ];
}

/** Illustrative numbers shown (labeled "Sample") only while no founding start date is set. */
export const DAY60_SAMPLE: Day60Raw = {
  start_date: null,
  coaches: [
    { id: 's1', name: 'Coach A', language: 'es', small_town: false, stay: true, live: true, minutes_to_live: 38, gatherings: 5, paying: 34, first_paid_days: 4, top_circle_paying: 34 },
    { id: 's2', name: 'Coach B', language: 'es', small_town: false, stay: true, live: true, minutes_to_live: 52, gatherings: 4, paying: 18, first_paid_days: 9, top_circle_paying: 18 },
    { id: 's3', name: 'Coach C', language: 'en', small_town: true, stay: true, live: true, minutes_to_live: 44, gatherings: 6, paying: 12, first_paid_days: 6, top_circle_paying: 12 },
    { id: 's4', name: 'Coach D', language: 'en', small_town: true, stay: null, live: true, minutes_to_live: 71, gatherings: 3, paying: 7, first_paid_days: 17, top_circle_paying: 7 },
    { id: 's5', name: 'Coach E', language: 'en', small_town: false, stay: true, live: true, minutes_to_live: 29, gatherings: 4, paying: 41, first_paid_days: 3, top_circle_paying: 41 },
    { id: 's6', name: 'Coach F', language: 'en', small_town: false, stay: false, live: false, minutes_to_live: null, gatherings: 0, paying: 0, first_paid_days: null, top_circle_paying: 0 },
  ],
  spanish_circles_15: 2, paying_members: 112, month1_members: 60, month1_retained: 50, in_person_members: 52, rsvps: 400, checked_in: 262,
};
