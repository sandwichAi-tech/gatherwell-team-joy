export function eventLocalInput(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function nextDaySchedule(endsAt: string, timezone: string): string {
  const local = eventLocalInput(endsAt, timezone);
  const day = new Date(`${local.slice(0, 10)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}T09:00`;
}