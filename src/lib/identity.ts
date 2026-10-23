/** Pure identity rules shared by the UI and mirrored by database functions. */

export type AgeBand = 'under_5' | '5_12' | '13_17';
export const AGE_BANDS: AgeBand[] = ['under_5', '5_12', '13_17'];

export type MinorInput = { firstName?: string; ageBand?: string; guardianConsent?: boolean };
export type MinorCheck = { ok: true; minor: null | { firstName: string; ageBand: AgeBand } } | { ok: false; error: 'minors_not_allowed' | 'minor_details_incomplete' | 'guardian_consent_required' | 'adult_required' };

/** Mirrors guard_minor_registration(): only on allowed events, both fields, separate consent, adult registrant. */
export function checkMinorRegistration(allowsMinors: boolean, adultAttested: boolean, input: MinorInput | null | undefined): MinorCheck {
  const first = input?.firstName?.trim() ?? '';
  const band = input?.ageBand ?? '';
  if (!first && !band) return { ok: true, minor: null };
  if (!adultAttested) return { ok: false, error: 'adult_required' };
  if (!allowsMinors) return { ok: false, error: 'minors_not_allowed' };
  if (!first || first.length > 40 || !AGE_BANDS.includes(band as AgeBand)) return { ok: false, error: 'minor_details_incomplete' };
  if (input?.guardianConsent !== true) return { ok: false, error: 'guardian_consent_required' };
  return { ok: true, minor: { firstName: first, ageBand: band as AgeBand } };
}

export type AdultAction = 'create_team' | 'host' | 'publish' | 'purchase' | 'subscribe';
/** Every adult-only action needs a recorded attestation; attending free events or learning does not. */
export function needsAdult(action: AdultAction | 'attend' | 'learn'): boolean {
  return action !== 'attend' && action !== 'learn';
}

export type ClaimRsvp = { id: string; eventId: string; userId: string | null; email: string | null; status: string; mergedInto: string | null; createdAt: string };
export type ClaimPlan = { claim: string[]; merge: { id: string; into: string }[] };

/** Mirrors claim_guest_records(): only unowned, unmerged rows with the verified email; never touches other users' rows; never deletes. */
export function planGuestClaim(rows: ClaimRsvp[], userId: string, verifiedEmail: string | null): ClaimPlan {
  const plan: ClaimPlan = { claim: [], merge: [] };
  const email = verifiedEmail?.trim().toLowerCase();
  if (!email) return plan;
  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const canonical = new Map<string, string>();
  for (const r of sorted) if (r.userId === userId && r.status !== 'cancelled' && !r.mergedInto && !canonical.has(r.eventId)) canonical.set(r.eventId, r.id);
  for (const r of sorted) {
    if (r.userId !== null || r.mergedInto || r.email?.trim().toLowerCase() !== email) continue;
    const into = canonical.get(r.eventId);
    if (into) plan.merge.push({ id: r.id, into }); else { plan.claim.push(r.id); canonical.set(r.eventId, r.id); }
  }
  return plan;
}

export type ViewMode = 'attending' | 'hosting';
export function defaultTabFor(mode: ViewMode): '/events' | '/home' { return mode === 'hosting' ? '/events' : '/home'; }
