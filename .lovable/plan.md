# Prompt 1: Make the approved ZoheeWell blueprint the source of truth and remove rule conflicts

Documentation only. Screens, database schema, business data, provider settings, feature flags and app behavior all stay as they are.

## What changes

1. **Project Knowledge.** Replace the current Project Knowledge with the approved text you supplied.
   - The current Project Knowledge is not empty: it holds about 30 Gatherwell architecture notes. Those notes move into `AGENTS.md`, reworded so they keep the engineering facts but cannot override product rules.
   - Updating Project Knowledge needs your approval in a card. If the card is unavailable, I'll give you the exact text to paste.
   - Check: the length stays under 10,000 characters and contains no secrets.

2. **New source-of-truth file** (`SOURCE_OF_TRUTH.md`, short):
   - Blueprint Version 4 is authoritative, decision date 2026-10-23.
   - Order of authority: Blueprint v4, then Project Knowledge, then PROJECT_RULES, then DESIGN_RULES, then AGENTS. Anything marked historical is never active.
   - Change control: any change to scope, price, fee, brand or policy needs explicit written approval and a CHANGELOG entry.

3. **Active guidance rewritten to agree with v4:**
   - `PROJECT_RULES.md`
     - ZoheeWell name, Event wording and full beta scope.
     - Exclusions, privacy and trust, content and AI rules.
     - A flat 5% fee; free products carry no fee.
     - Plans with annual billing at two months free.
     - Founding host offer.
     - English and Spanish both at launch.
     - The quality checklist.
     - The old ZoheeWell 0.1 section is merged in, not kept alongside.
   - `DESIGN_RULES.md`: colours #302338, #C78E76, #D8D0C6, #F8F5F0; Noto Sans; official logo assets only. Old palette and "premium reset" wording removed.
   - `AGENTS.md` and `supabase/AGENTS.md`
     - Engineering rules from v4.
     - Remove "paid event checkout must not be enabled", "only plans and licenses sold" and the Spanish-off convention as active rules.
     - Note that the current code still uses the old fee and colours until later prompts change it.
   - `README.md`: ZoheeWell naming and a pointer to the source-of-truth file.
   - `roadmap.md`: remove the old fee and price items as active tasks, and point to the Prompt 1–17 sequence.

4. **Historical labelling, with content kept for audit history:**
   - Files: `FEATURE_INVENTORY.md`, `LAUNCH_REVIEW.md`, `SECURITY_NOTES.md`, `DEAD_CLICKS.md`, `DESIGN_AUDIT.md`, `MOBILE_AUDIT.md`, and archived plans under `.lovable/plan/`.
   - Each gets a top banner: "Historical record, pre Blueprint v4 (2026-10-23). Not an active instruction; where it conflicts, SOURCE_OF_TRUTH.md wins."
   - Migrations are left untouched.

5. **Project memory** (this is the saved memory that steers future work):
   - Replace the pricing memory with the 5% fee and the new plans.
   - Replace the billing-rules memory: keep cancel, downgrade and failed-payment timing; drop "only plans sold".
   - Replace the ZoheeWell brand memory with the new palette.
   - Remove the core rule "Spanish is paused".
   - Update the homepage and launch memories where they conflict, for example "paid tickets coming soon" and Gatherwell visuals.

6. **CHANGELOG.md, new v0.8 "Instruction reset to Blueprint v4":** lists the files touched and says plainly that no product behavior, screen, schema, data or provider setting changed.

## How I'll check it (acceptance)
- Search all `*.md` files and memory for conflicts: 7%, 2%, 0% fee, "3% + 49", #35263F, #F4C7A1, #F7F0F0, #E8E3EC, Gatherwell, Gathering as the visible noun, Spanish paused, paid tickets off. Every hit must be in a migration, a historical-banner file, or the CHANGELOG.
- Confirm through version history that only documentation, memory and Project Knowledge changed. No file under `src/` or `supabase/migrations`, and no package files.
- Character count of Project Knowledge is 10,000 or less.
- The existing 88 automated checks still pass. This is only a sanity check; no behavior changed.

## Known gaps, stated honestly
- The app itself still shows the old palette and fees, and Spanish stays switched off until the later prompts that change them. The documents will say so explicitly.
- I don't have the Blueprint v4 document itself. The source-of-truth file will reference it by name and date, and copy only the approved text you pasted here.
