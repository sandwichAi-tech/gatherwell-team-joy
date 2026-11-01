# ZoheeWell Platform Agreement — Version 2.0 DRAFT (not in effect)

Draft ID: `platform-agreement-v2.0-draft` (this folder). Status: **DRAFT — owner-supplied, attorney review pending. NOT approved, NOT active, NOT published.**

Imported 2026-11-01 from the owner's upload `ZoheeWell_Platform_Agreement.docx`. This folder is project source only: it is not under `public/`, no route serves it, and no database row exists for it.

## Files
| File | Purpose | SHA-256 |
|---|---|---|
| `ZoheeWell_Platform_Agreement.original.docx` | Byte-identical copy of the owner's upload (authoritative source) | `0d01fc1a84df6b0d1db85a89c72cce04e0ba041634a59c30d4e6afe3435740af` |
| `ZoheeWell_Platform_Agreement.rev1-2026-11-01.docx` | **Current working draft** (owner clarification 2026-11-01; still DRAFT) | `40a5517721c9862daef3faa8e26c2a7e53f2ce55b62271edb7feeb18076a1c21` |
| `ZoheeWell_Platform_Agreement.rev1-2026-11-01.en.md` | Text extraction of rev1 | `b6ac0ac9bcb46761d2dfbf734e6d454c151fccefac43357b9648143fc4c97827` |
| `ZoheeWell_Platform_Agreement.en.md` | Unedited pandoc text extraction for review/diffing (derived; the .docx wins on any difference) | `1af5e36d7a98404dce384cf64bbb1f2cb0bc544dde7be3b0139cd19a0bf27842` |

Fidelity check: identical 6,880-word multiset to the .docx; word order identical except Schedule A, where table cells are read row-by-row. Contains the draft disclaimer, Sections 1–25, Schedule A, Schedule B (participant + host listing acknowledgments) and all 10 "Notes for Attorney Review". Bracketed placeholders were kept as written; nothing was filled in, removed or translated.

## Rev1 alterations (owner clarification, Nick Coromelas, 2026-11-01)
Only these seven phrases changed versus the original; every other paragraph is byte-for-byte identical in the text diff. Draft banner, brackets elsewhere and all 10 attorney notes kept.
1. Header: `Last updated: [DATE] · Effective date: [DATE]` → `Last updated: November 1, 2026 · Effective date: November 1, 2026`
2. 1.1: `[ZoheeWell, LLC], a [Wyoming limited liability company]` → `Zoheewell LLC, a [Wyoming limited liability company]` (formation state not confirmed, bracket kept)
3. 6.2: `[ZoheeWell, LLC]` → `Zoheewell LLC`
4. 25.7: `[ZoheeWell, LLC, 30 N Gould St, Ste R, Sheridan, WY 82801]` → `[Zoheewell LLC, 30 N Gould St, Ste R, Sheridan, WY 82801]` (bracket kept: it also covers the notice address, not confirmed for this clause)
5. 10.2: `(currently 5% on Free, 3% on Advanced, 2% on Pro, 1% on Team 25, and 0.5% on Organization)` → `(currently 5% on all plans)`; "Processor fees are separate" and the rest unchanged
6. 25.1: `[Wyoming / California]` → `Wyoming`
7. 25.1: `[Sheridan County, Wyoming / Orange County, California]` → `Sheridan County, Wyoming`

## Open items before this can be approved (owner/counsel)
- Resolved in rev1: entity name, dates, governing law, venue, 10.2 flat 5%. Still open: state of formation wording, 25.7 notice address bracket, notice periods, insurance thresholds, retention, non-circumvention term, DMCA agent address, linked policy names.
- Section 10.2 now says flat 5% per owner. Runtime fee rules (fee_rules) were not changed; if they still apply a per-plan ladder, they must be aligned before this agreement is activated.
- Section 10.3 merchant-of-record wording needs checking against the Stripe Connect setup (attorney note 5).
- "Notes for Attorney Review" and the draft banner must be removed only by counsel/owner in a new approved version, never in this file.
- Spanish: a professional translation is required (attorney note 9). No machine translation.

## Integration path when approved (not done)
Activation uses the existing mechanism: insert `consent_text_versions` rows (`kind='event_agreement'`, `team_id NULL`, one per locale `en`/`es`, next version) with the approved final text and its SHA-256, plus `approval_reference`, `approved_at`, an `https://` `document_url` and `effective_from`. `approved_event_agreement()` only selects rows that have all of those, and the pin trigger pins published events once they are approved. Do not insert this draft into that table: platform rows are readable by every signed-in user, and the table has no draft state.
