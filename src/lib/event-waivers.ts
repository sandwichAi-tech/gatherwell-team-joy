/**
 * Event-specific waivers/acknowledgments (additive to Terms/Privacy and the team waiver).
 * Pure helpers: what the attendee must do before RSVP/checkout, what is sent to the server,
 * and the host's export rows. Versions, hashes and times are always set by the database.
 */

export const WAIVER_KINDS = ['waiver', 'release', 'health', 'safety', 'media'] as const;
export type WaiverKind = (typeof WAIVER_KINDS)[number];

export type PublicWaiver = {
  id: string; kind: WaiverKind; title_en: string; title_es: string; body_en: string; body_es: string;
  has_file: boolean; file_name: string | null; required: boolean; version: number;
};

/** Attendee state per waiver: accepted checkbox (never prechecked) and whether the file was opened. */
export type WaiverChoice = { accepted: boolean; opened: boolean };
export type WaiverChoices = Record<string, WaiverChoice>;

export const initialChoices = (list: PublicWaiver[]): WaiverChoices =>
  Object.fromEntries(list.map(w => [w.id, { accepted: false, opened: false }]));

/** A file-backed waiver can be accepted only after it was opened. */
export const canAccept = (w: PublicWaiver, c: WaiverChoice | undefined) => !w.has_file || !!c?.opened;

/** Required items still blocking RSVP/checkout. Optional items never block. */
export const missingRequired = (list: PublicWaiver[], choices: WaiverChoices) =>
  list.filter(w => w.required && !(choices[w.id]?.accepted && canAccept(w, choices[w.id])));

export const waiversReady = (list: PublicWaiver[], choices: WaiverChoices) => missingRequired(list, choices).length === 0;

/** Only id + the version the attendee saw; the server rejects anything stale. */
export const acceptedPayload = (list: PublicWaiver[], choices: WaiverChoices) =>
  list.filter(w => choices[w.id]?.accepted && canAccept(w, choices[w.id])).map(w => ({ id: w.id, version: w.version }));

export const waiverTitle = (w: { title_en: string; title_es: string }, lang: string) =>
  (lang === 'es' ? w.title_es || w.title_en : w.title_en || w.title_es) || '';
export const waiverBody = (w: { body_en: string; body_es: string }, lang: string) =>
  lang === 'es' ? w.body_es || w.body_en : w.body_en || w.body_es;

export type WaiverStatus = {
  waivers: { id: string; title_en: string; title_es: string; required: boolean; version: number }[];
  attendees: { rsvp_id: string; name: string; status: string; accepted: Record<string, { version: number; at: string }> }[];
};

export type ConsentState = 'current' | 'outdated' | 'missing' | 'optional_skipped';

export function consentState(w: WaiverStatus['waivers'][number], a: WaiverStatus['attendees'][number]): ConsentState {
  const got = a.accepted[w.id];
  if (!got) return w.required ? 'missing' : 'optional_skipped';
  return got.version === w.version ? 'current' : 'outdated';
}

/** Export rows: name, status and per-waiver state/version/time only — no contact details. */
export function consentRows(s: WaiverStatus, lang: string, label: (k: ConsentState) => string): string[][] {
  const head = ['Name', 'RSVP', ...s.waivers.flatMap(w => [waiverTitle(w, lang), `${waiverTitle(w, lang)} (version)`, `${waiverTitle(w, lang)} (accepted)`])];
  return [head, ...s.attendees.map(a => [a.name, a.status, ...s.waivers.flatMap(w => {
    const st = consentState(w, a); const got = a.accepted[w.id];
    return [label(st), got ? String(got.version) : '', got ? got.at : ''];
  })])];
}

/** Server error code → localized key. */
export const waiverErrorKey = (msg: string | undefined) =>
  msg?.includes('waiver_stale') ? 'eventWaivers.errors.stale' : msg?.includes('waiver_required') ? 'eventWaivers.errors.required' : null;
