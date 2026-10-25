# SEO / AEO Audit — ZoheeWell (2026-10-25)

Authoritative indexability policy and structured-data inventory. Canonical base:
`https://zoheewell.com` (single source: `SITE_URL` in `src/lib/seo.ts`). Preview and
project-ID service URLs are never emitted in canonicals, og:url, robots, or sitemap.

## Route policy

### Indexable (canonical + og:url, unique title/description)

| Route | Notes |
|---|---|
| `/` | Organization + WebSite JSON-LD |
| `/discover` | Clean catalog only; any filter, non-default tab, or `sort` param → `noindex, follow` |
| `/pricing`, `/faq`, `/hosts`, `/studios` | `/faq` carries the site's only FAQPage JSON-LD |
| `/about`, `/careers` | Company pages; no schema (AboutPage adds nothing over the homepage Organization block, and there is no real opening to support JobPosting) |
| `/terms`, `/privacy`, `/credits`, `/legal/{host,guest,sms,cookies}` | Legal pages render headings after hydration (AuthFrame is ClientOnly) |
| `/e/$id` | Event JSON-LD from real public fields (name, startDate, status, attendance mode, Place/VirtualLocation, organizer, image; Offer only when a real price exists, else `isAccessibleForFree`). Unresolvable/private events → `noindex` fallback. |
| `/h/$slug` | ProfilePage JSON-LD wrapping Person/Organization; old slugs 301-redirect via alias resolution |
| `/l/$slug`, `/t/$slug` | Public location/team pages, canonical per slug |
| `/o/$id` | Public offer detail, canonical per id |
| `/verify/$number` | Certificate verification |

### noindex (robots meta + robots.txt Disallow)

- Auth/onboarding: `/login`, `/admin-login`, `/join/$code`, `/onboarding`
- Token/code routes: `/i/$code`, `/i/host/$token`, `/r/$code`, `/unsubscribe/$token`
- All signed-in app routes (`/home`, `/events`, `/learn`, `/team`, `/me`, `/plan`,
  `/tools`, `/communications`, `/support`, `/saved`, `/following`, `/inbox`,
  `/notifications`, `/updates`, `/alerts`, `/progress`, `/network`, `/circles`,
  `/offers`, `/offer/$id`, `/promos`, `/blueprints`, `/start`, `/ticket/$code`,
  `/locations`, `/insights`, `/earnings`, `/followups`, `/event/*`, `/gathering/*`,
  `/challenge/*`, `/admin/*`) — enforced via `gatherwellHead` (`noindex, nofollow`)
  or per-route robots meta.
- Filtered Discover permutations (`?tab=resources|coaches`, any filter, `?sort=newest`).
- Missing/unpublished detail pages (loader-null fallbacks carry `noindex`).
- 404 route renders the root not-found component with a real 404 status.

## robots.txt / sitemap

- `public/robots.txt`: `Allow: /` with Disallow for every private/auth/token surface;
  `Sitemap: https://zoheewell.com/sitemap.xml`.
- `src/routes/sitemap[.]xml.ts`: 15 canonical public routes only
  (`/`, `/discover`, `/pricing`, `/faq`, `/hosts`, `/studios`, `/about`, `/careers`,
  `/terms`, `/privacy`, `/credits`, `/legal/host|guest|sms|cookies`). No `<lastmod>` — there is no
  authoritative page-specific content timestamp. Dynamic event/coach URLs are
  intentionally omitted until a bounded, published-only server-side listing exists;
  they remain discoverable through `/discover` and internal links.

## Structured data inventory

- Organization + WebSite: `/` only (site-wide identity, no duplicates elsewhere).
- FAQPage: `/faq` only, generated from the same English SSR Q&A the page shows.
- Event: `/e/$id` for published public events; no ratings, attendance counts, or
  fabricated offers.
- ProfilePage (Person/Organization): `/h/$slug` for published public coach pages.
- No Course/LearningResource schema yet: public resource pages (`/o/$id`) do not
  expose enough verified structure (provider, syllabus) to qualify truthfully.
- No BreadcrumbList: public routes are at most two levels deep.

## AEO fundamentals

- Each public page has one clear job, a single h1, concise direct answers, and
  descriptive internal links (Create an event, Discover, pricing, support).
- Beta limitations are stated plainly (payments/SMS setup-required states, draft
  legal docs marked as drafts).
- No keyword stuffing, fake geo pages, hidden text, doorway pages, fake statistics,
  or invented testimonials.

## Locale

EN and ES share one URL per page (client-side language switch, SSR in English).
Because there are no separate locale URLs, **hreflang is deliberately not emitted** —
claiming it would be incorrect. `lang` is set on `<html>` and updated on language change.

## Validation commands

- `bunx vitest run src/lib/seo.test.ts` — policy helpers, robots.txt, sitemap source.
- `bunx vitest run` — full suite (433 tests at audit time).
- `bunx tsgo --noEmit` — typecheck.
- Browser/source checks: SSR `<title>`, description, canonical, og:url, robots,
  JSON-LD per route; 404 status on malformed paths; noindex on auth/token routes.

## Known limitations

- Legal pages and other AuthFrame/ClientOnly surfaces render their h1 after
  hydration; crawlers that execute JS see them, raw-HTML crawlers see title/meta only.
- Dynamic public detail URLs (events, coaches) are not in the XML sitemap yet.
- Screen-reader narration not re-tested in this pass (ARIA inspected via DOM).
- Signed cover URLs in og:image expire after 7 days; crawlers that re-scrape later
  still get a fresh URL because each SSR signs anew.

## Remaining go-live actions (no credentials added now)

1. Confirm `zoheewell.com` serves the published build and that canonical/og:url
   resolve there (already the configured primary domain).
2. Verify the property in Google Search Console and Bing Webmaster Tools; submit
   `https://zoheewell.com/sitemap.xml`.
3. After publish, re-check link previews (platform debuggers) — crawlers serve the
   last scraped version until they re-fetch.
4. Decide on analytics + consent banner before enabling any tracking.
5. Set up performance monitoring (Core Web Vitals) on the production domain.
6. Content governance: keep titles/descriptions truthful as marketing copy evolves;
   re-run this audit when routes are added or removed.
