# ZoheeWell Platform Agreement — Version 2.0 DRAFT (not in effect)

Draft ID: `platform-agreement-v2.0-draft` (this folder). Status: **DRAFT — owner-supplied, attorney review pending. NOT approved, NOT active, NOT published.**

Imported 2026-11-01 from the owner's upload `ZoheeWell_Platform_Agreement.docx`. This folder is project source only: it is not under `public/`, no route serves it, and no database row exists for it.

## Files
| File | Purpose | SHA-256 |
|---|---|---|
| `ZoheeWell_Platform_Agreement.original.docx` | Byte-identical copy of the owner's upload (authoritative source) | `0d01fc1a84df6b0d1db85a89c72cce04e0ba041634a59c30d4e6afe3435740af` |
| `ZoheeWell_Platform_Agreement.en.md` | Unedited pandoc text extraction for review/diffing (derived; the .docx wins on any difference) | `1af5e36d7a98404dce384cf64bbb1f2cb0bc544dde7be3b0139cd19a0bf27842` |

Fidelity check: identical 6,880-word multiset to the .docx; word order identical except Schedule A, where table cells are read row-by-row. Contains the draft disclaimer, Sections 1–25, Schedule A, Schedule B (participant + host listing acknowledgments) and all 10 "Notes for Attorney Review". Bracketed placeholders were kept as written; nothing was filled in, removed or translated.

## Open items before this can be approved (owner/counsel)
- Entity name/type, last-updated and effective dates (`[DATE]`), governing law `[Wyoming / California]` and venue `[Sheridan County, Wyoming / Orange County, California]`, notice periods, insurance thresholds, retention, non-circumvention term, DMCA agent address, linked policy names.
- Section 10.2 states a per-plan fee ladder (5/3/2/1/0.5%). SOURCE_OF_TRUTH.md says a flat 5%; project memory records an approved 2026-10-24 per-plan ladder with these same numbers. The owner must confirm which is current before approval. No fee code was changed.
- Section 10.3 merchant-of-record wording needs checking against the Stripe Connect setup (attorney note 5).
- "Notes for Attorney Review" and the draft banner must be removed only by counsel/owner in a new approved version, never in this file.
- Spanish: a professional translation is required (attorney note 9). No machine translation.

## Integration path when approved (not done)
Activation uses the existing mechanism: insert `consent_text_versions` rows (`kind='event_agreement'`, `team_id NULL`, one per locale `en`/`es`, next version) with the approved final text and its SHA-256, plus `approval_reference`, `approved_at`, an `https://` `document_url` and `effective_from`. `approved_event_agreement()` only selects rows that have all of those, and the pin trigger pins published events once they are approved. Do not insert this draft into that table: platform rows are readable by every signed-in user, and the table has no draft state.
