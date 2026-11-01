/**
 * Event invitation routing. Invite-only customer events are signed up for on the
 * public guest page (/e/:id?k=token) — never through the signed-in app route
 * (/event/:id), which sits behind team onboarding and asks for a team code.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const APP_EVENT = new RegExp(`^/event/(${UUID})/?$`, 'i');
const GUEST_EVENT = new RegExp(`^/e/${UUID}(\\?|$)`, 'i');

type ShareInput = { id: string; visibility: string | null | undefined; invite_token?: string | null };

/**
 * Link a host shares. Public → guest page; invite-only → guest page with its token
 * (null when the token is unknown, so callers fetch it instead of sending a team-gated link);
 * My team only → the signed-in app page.
 */
export function eventShareLink(origin: string, e: ShareInput): string | null {
  if (e.visibility === 'invite') return e.invite_token ? `${origin}/e/${e.id}?k=${encodeURIComponent(e.invite_token)}` : null;
  if (e.visibility === 'public') return `${origin}/e/${e.id}`;
  return `${origin}/event/${e.id}`;
}

/** Return path that belongs to event signup (guest page). Such returns skip team steps in onboarding. */
export function isEventSignupReturn(path: string | null | undefined): boolean {
  return !!path && GUEST_EVENT.test(path);
}

/**
 * A person who has not finished onboarding but opened an app event link
 * (/event/:id) is sent to the event's guest page instead of team onboarding.
 * The guest page decides access from the invitation itself; nothing is granted here.
 */
export function guestEventRedirect(pathname: string, search: string): string | null {
  const m = APP_EVENT.exec(pathname);
  if (!m) return null;
  const k = new URLSearchParams(search).get('k');
  return `/e/${m[1]}${k && /^[A-Za-z0-9_-]{16,80}$/.test(k) ? `?k=${k}` : ''}`;
}

/** Steps an onboarding visitor returning to event signup must still complete (adult is required for accounts). */
export function eventSignupSteps<T extends string>(all: T[]): T[] {
  return all.filter(s => s === 'adult' || s === 'name');
}
