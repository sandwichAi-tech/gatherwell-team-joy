export type EventSession = { title: string; starts_at: string; ends_at: string; place: string };
export function validSessions(rows: EventSession[], start: string) {
  if (rows.length < 2 || rows.length > 20) return false;
  const first = Date.parse(start); let previous = first;
  return rows.every(row => {
    const a = Date.parse(row.starts_at); const b = Date.parse(row.ends_at);
    const valid = row.title.trim().length > 0 && row.title.length <= 100 && row.place.length <= 300 && Number.isFinite(a) && Number.isFinite(b) && a >= previous && b > a && b <= first + 31 * 86400000;
    previous = b; return valid;
  });
}