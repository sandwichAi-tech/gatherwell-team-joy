/** Mirrors decide_referrer / accept_referral_terms / referral_member_active (migration 0208). The database is authoritative. */
export type MemberStatus = 'invited' | 'requested' | 'approved' | 'rejected' | 'revoked';
export type OwnerAction = 'approve' | 'reject' | 'revoke';
export type Membership = { status: MemberStatus; termsAccepted: boolean } | null;

export function ownerTransition(status: MemberStatus, action: OwnerAction): MemberStatus | null {
  if (action === 'approve') return status === 'requested' ? 'approved' : null;
  if (action === 'reject') return status === 'invited' || status === 'requested' ? 'rejected' : null;
  return status === 'invited' || status === 'requested' || status === 'approved' ? 'revoked' : null;
}

/** Owner actions that are valid for a row, in display order. */
export function ownerActions(status: MemberStatus): OwnerAction[] {
  return (['approve', 'reject', 'revoke'] as const).filter(a => ownerTransition(status, a) !== null);
}

/** Accepting terms needs an owner invite or approval and an approved terms document. */
export function acceptTerms(m: Membership, termsApproved: boolean): { ok: true; next: { status: 'approved'; termsAccepted: true } } | { ok: false; error: 'not_invited' | 'terms_unavailable' } {
  if (!m || (m.status !== 'invited' && m.status !== 'approved')) return { ok: false, error: 'not_invited' };
  if (!termsApproved) return { ok: false, error: 'terms_unavailable' };
  return { ok: true, next: { status: 'approved', termsAccepted: true } };
}

/** Only an approved member who accepted terms gets a link, counted clicks or new rewards. */
export const isActive = (m: Membership) => !!m && m.status === 'approved' && m.termsAccepted;

/** What the item-page card should offer the signed-in visitor. */
export type CardState = 'share' | 'request' | 'waiting' | 'accept' | 'terms_missing' | 'closed';
export function cardState(m: Membership, termsApproved: boolean): CardState {
  if (isActive(m)) return 'share';
  if (!m) return 'request';
  if (m.status === 'requested') return 'waiting';
  if (m.status === 'invited' || m.status === 'approved') return termsApproved ? 'accept' : 'terms_missing';
  return 'closed';
}
