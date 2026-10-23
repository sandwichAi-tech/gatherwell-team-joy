> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# Gatherwell launch review

## Status

This pass improves launch readiness, but does not certify the entire checklist complete. The production two-second 4G target remains unverified; the cold development-server measurement failed it. The two-account journey was deliberately skipped.

## 1. Report spam limit

- Applied a dedicated limit of five reports per rolling minute, keyed by signed-in user or guest IP.
- Added a transaction advisory lock to serialize concurrent attempts for the same limiter key.
- Reused the bilingual rate-limit error and documented the rule in SECURITY_NOTES.md.

## 2. Mobile and visual polish

- Reviewed 69 signed-in screen/width combinations at 375, 414 and 1440 pixels, plus public routes at those widths; no document-level horizontal overflow or page errors were observed.
- Improved wrapping for settings values, sheet titles, guest names, action rows and segmented controls.
- Added safe-area padding for top bars, page content, sheets and check-in mode.
- Standardized relevant buttons to at least 44px desktop / 48px mobile; enlarged switch and checkbox hit areas without enlarging their visible controls.
- Adjusted semantic muted, lavender, success and dark destructive colors for readable text while retaining the plum/lavender art direction.
- Retained consistent 12px control / 16px card geometry and removed negative heading tracking.
- This was not a review of every populated event, lesson, challenge, dialog and admin-tab state; no real published gathering was available for a complete live detail sweep.

## 3. Spanish and locale formatting

- Added matched bilingual launch-state and accessibility copy.
- Localized the sheet close control and replaced targeted hard-coded loading copy.
- Adjusted guest gathering date formatting to English/Latin American Spanish locales; checked date, time, distance, storage and currency formatting helpers.
- Verified language switching on the landing page and the document language attribute.
- Confirmed all 1,851 English translation keys have Spanish counterparts, with no missing keys in either direction and no emoji in either resource.
- Resource parity is not proof that every runtime string is translated or that every Spanish sentence received an editorial review. Those exhaustive checks remain open.

## 4. Speed and loading

- Added reusable ListSkeleton, RetryState and query-cache-aware QueryFeedback components.
- Wired shared feedback into signed-in, guest and landing surfaces; added targeted skeletons to gatherings, team lists, Learn, challenges, follow-ups and admin loading states.
- Added a Retry action when an initial skeleton remains visible for 12 seconds, rather than leaving an indefinite loading screen.
- Routed gathering covers through BrandImage, retaining lazy loading, asynchronous image decoding, brand grading and existing responsive delivery where supported. Existing upload processing produces WebP; this pass did not add multi-size AVIF variants for every upload.
- Added anonymous public GET caching for landing, Discover and valid gathering URLs: 30-second browser cache, 60-second shared cache and 60-second stale-while-revalidate. Requests with authorization or cookies remain private/no-store.
- Verified the public cache header in the local server.
- Measured a cold Vite development session at 1.6 Mbps download and 150ms latency: first paint 1.75 seconds, meaningful landing heading about 153 seconds. First paint is not the requested meaningful screen. Development module loading makes this unsuitable for a production benchmark, but the two-second requirement cannot be claimed as passed.
- Production CDN caching, production first-screen timing and an exhaustive unused-dependency cleanup remain open.

## 5. Reliability

- Added an in-memory check-in queue with duplicate/latest-intent handling, online-event sync, a five-second retry loop and an unsynced-navigation warning.
- Retryable transport/server errors remain queued; nonretryable database errors show a friendly message instead of looping forever.
- Kept guest names and check-in codes out of persistent browser storage.
- Added connection/pending states and manual Retry; guest QR stays legible with fixed light/dark QR colors.
- Added route-level retry states and a branded bilingual 404 with a home action.
- Fixture browser checks confirmed offline queueing, one sync call when connectivity returned, refreshed check-in state, offline SVG QR rendering and QR download.
- Offline support requires the already-loaded page to remain open. Refreshing/closing it does not preserve pending check-ins, and a first visit while offline is not supported. Ambiguous transport failures against non-idempotent RPCs require additional live validation.

## 6. Accessibility

- Added a skip-to-content link and main-content targets.
- Added targeted icon/control labels, enlarged sheet close controls and improved dialog title spacing.
- Preserved visible focus rings and added reduced-motion refinements.
- Automated WCAG 2 A/AA and 2.1 AA checks reported no violations across ten main routes in light and dark themes after theme transitions settled.
- Verified keyboard focus enters the profile dialog and Escape closes it.
- This is not a full manual accessibility certification: every sheet, form state, screen-reader flow and target spacing still needs exhaustive review.

## 7. Share images

- Generated a 1200 × 630 premium Gatherwell share fallback in plum, lavender and peach.
- Added server-resolved Open Graph / Twitter images to landing, Discover, team invite and public gathering metadata.
- Uploaded public share images can use a seven-day signed URL; missing media falls back to the bundled branded card.
- Verified share tags in server HTML and resolving fallback image URLs on landing, Discover and the available team invite.
- Live published-gathering share rendering and external social-crawler previews remain unverified.

## 8. Previously pending quick checks

- Confirmed the RSVP consent step's SMS terms link opens /legal/sms in a new tab.
- Confirmed all six legal links in Me open the correct pages.
- Confirmed landing footer legal links and Credits open the correct routes.
- Confirmed the landing CTA reaches the analytics helper with hero_find_click.
- Confirmed missing analytics configuration returns sent:false without blocking the interaction.
- Confirmed offline QR save and pending-to-synced check-in states using browser fixtures.

## Tests and exclusions

- 19 targeted tests passed: three queue tests and 16 routing tests.
- Main-screen browser sweeps observed no page errors; automated accessibility checks returned no violations for the tested routes/themes.
- Trial/fixture data was removed. No two-account journey was run.
- Existing provider-key-dependent live payments, push, messaging, maps and AI checks were outside this pass and remain unverified.
- Existing security findings were not represented as resolved by this launch pass.

## Remaining launch gates

1. Benchmark and optimize the deployed production landing/public pages on cold 4G until meaningful content is under two seconds.
2. Review all populated detail screens, dialogs and admin states at the requested widths; complete manual accessibility and Spanish editorial coverage.
3. Validate weak-connection check-in against real data, including ambiguous RPC outcomes; decide whether reload-safe offline persistence is required.
4. Validate a live published gathering's share image with social crawlers and verify CDN behavior.
5. Complete upload-wide responsive format coverage and unused-code/dependency cleanup.