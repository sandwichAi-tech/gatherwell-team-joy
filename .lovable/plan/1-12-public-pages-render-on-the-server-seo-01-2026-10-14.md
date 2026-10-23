> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# 1.12 — Public pages render on the server (SEO-01)

## What we found
Checked what the server sends for /, /hosts, /pricing, /studios and /discover: every one comes back with only the "Loading…" placeholder and no headline.

Two things cause it, and neither is the sign-in check:

1. **Marketing pages are wrapped in a "browser only" frame.** Every marketing page (/, /hosts, /pricing, /studios, and the Discover shell) sits inside `LandingFrame`, which wraps the nav, the page and the footer in `ClientOnly` with an empty fallback. We added it so a Spanish phone wouldn't see English first and cause a mismatch. The side effect is that the server sends an empty box, so crawlers, AI search and text previews see nothing until the browser JavaScript runs (about 6 s on phones).
2. **The app-wide loading placeholder.** The root route uses `ListSkeleton` as its `pendingComponent`, so while the browser-only part is waiting, the server writes the "Loading…" skeleton.

## Plan
- **Render the page itself on the server, in English.** Take the `ClientOnly` wrapper off `LandingFrame` so the headings, copy, cards, pricing table and FAQ come from the server.
- **Switch language right after the page loads.** The root already reads the saved/browser language after the page appears and switches instantly through i18n. Spanish visitors see the page switch to Spanish right away. There's no mismatch, because the first browser render is English, the same as the server.
- **Keep only the small personal parts browser-only.** The language toggle state, the "Sign in / Open app" nav button (session check), the sticky find bar, and anything that reads saved settings go into small client-only pieces with placeholders the same size, so nothing jumps.
- **Discover:** server-render the heading, filters and category chips; the gathering list keeps loading on the client for now (1.13 moves that list into the server loader).
- **Root placeholder:** stop showing the skeleton for these public routes (no `pendingComponent` on them), so the server never writes "Loading…" in place of content.
- Signed-in routes stay exactly as they are.

## Check (after build)
- `curl /hosts | grep -c "Run gatherings people come back to"` returns 1 or more.
- `curl / | grep -c "Find your people"` returns 1 or more.
- /pricing, /studios and /discover show their h1 in the server response.
- In the browser in Spanish, at 390px and 1440px: the page switches to Spanish, no console hydration warnings, nothing shifts.

## Technical notes
- Files: `src/components/landing/landing-chrome.tsx` (LandingFrame, LandingNav auth button), `src/routes/__root.tsx` (pendingComponent), the five route files, the Discover page component.
- Project knowledge says public surfaces render through ClientOnly to avoid language hydration mismatch. This plan replaces that rule for marketing pages ("server renders English; language switches after hydration") and updates AGENTS.md / PROJECT_RULES.md to match.
