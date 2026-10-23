export type BriefEvent = { id: string; host_id: string; team_id: string | null; title: string; starts_at: string; location_name: string | null; status: string; going: number };
export type BriefLine = { key: string; label: string; values: Record<string, string | number>; target: 'event' | 'attending' | 'team' | 'resource'; id?: string };
export type BriefInput = {
  userId: string; now: string; timezone: string; events: BriefEvent[];
  attending: { event: BriefEvent; code: string | null }[];
  signups: { event_id: string; created_at: string }[];
  leaderTeams: string[]; hosts: { user_id: string; team_id: string }[];
  resources: { id: string; title: string; created_at: string; kind: 'track' | 'lesson' | 'recipe' }[];
};
export function briefDay(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
}
/** Pure rules; the input is fetched under the caller's RLS, never from a shared cache. */
export function buildMorningBrief(input: BriefInput): BriefLine[] {
  const { userId, now, timezone } = input;
  const today = briefDay(now, timezone), yesterday = shiftDay(today, -1);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekStart = shiftDay(today, -(weekday + 6) % 7), weekEnd = shiftDay(weekStart, 7);
  const upcoming = input.events.filter(e => e.status === 'published' && e.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const own = upcoming.filter(e => e.host_id === userId);
  const inWeek = (e: BriefEvent) => { const day = briefDay(e.starts_at, timezone); return day >= weekStart && day < weekEnd; };
  const lines: BriefLine[] = [];
  const next = own[0];
  if (next) lines.push({ key: 'hosting', label: 'hosting', values: { title: next.title, when: next.starts_at, place: next.location_name ?? '', count: next.going }, target: 'event', id: next.id });
  const ownedIds = new Set(input.events.filter(e => e.host_id === userId && e.status === 'published').map(e => e.id));
  const recent = input.signups.filter(r => ownedIds.has(r.event_id) && r.created_at <= now && briefDay(r.created_at, timezone) >= yesterday);
  if (recent.length) lines.push({ key: 'signups', label: 'signups', values: { count: recent.length }, target: 'event', id: recent[0]?.event_id });
  for (const e of own.filter(e => inWeek(e) && e.going === 0)) lines.push({ key: `share-${e.id}`, label: 'share', values: { title: e.title }, target: 'event', id: e.id });
  const attendance = input.attending.filter(r => r.event.status === 'published' && r.event.starts_at >= now && r.event.host_id !== userId).sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at))[0];
  if (attendance) lines.push({ key: 'attending', label: attendance.code ? 'attendingCode' : 'attending', values: { title: attendance.event.title, when: attendance.event.starts_at, code: attendance.code ?? '' }, target: 'attending', id: attendance.event.id });
  if (input.leaderTeams.length) {
    const teamEvents = input.events.filter(e => e.status === 'published' && e.team_id && input.leaderTeams.includes(e.team_id) && inWeek(e));
    if (teamEvents.length) lines.push({ key: 'team-events', label: 'teamEvents', values: { count: teamEvents.length }, target: 'team' });
    const scheduled = new Set(upcoming.map(e => e.host_id));
    const quiet = new Set(input.hosts.filter(h => input.leaderTeams.includes(h.team_id) && !scheduled.has(h.user_id)).map(h => h.user_id));
    if (quiet.size) lines.push({ key: 'quiet-hosts', label: 'quietHosts', values: { count: quiet.size }, target: 'team' });
  }
  const cutoff = shiftDay(today, -7);
  for (const r of input.resources.filter(r => r.created_at <= now && briefDay(r.created_at, timezone) >= cutoff).sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    lines.push({ key: `resource-${r.kind}-${r.id}`, label: 'resource', values: { title: r.title, kind: r.kind }, target: 'resource', id: r.id });
  }
  return lines;
}