# Gatherwell design rules

These rules permanently replace all earlier visual and tone instructions in PROJECT_RULES.md. Every future change must follow this file. Product, bilingual, privacy and frontend-only requirements remain in force.

## Palette
- Canvas #F7F7F9; surface #FFFFFF; 1px hairline border #E8E6EE.
- Ink #1C1726; body #4A4458; muted #8A8496.
- Primary plum #2F2340: active navigation, primary buttons, dark feature cards.
- Lavender #7A5FA8: links, progress bars and restrained accents; chip tint #EFEBF6.
- Peach #F3C6A5: accent buttons ONLY on dark plum surfaces (and the requested logo letter); warm chip tint #FBEDE3.
- Success #2E9E6B, used sparingly.
- Implement colors as semantic Tailwind/global CSS tokens with an accessible corresponding dark theme.

## Typography and geometry
- Inter from Google Fonts; tabular numbers for stats.
- Page titles 40px/700; requested tracking -0.03em. Section titles 20px/600; requested tracking -0.01em. Project authoring constraint takes precedence: render heading tracking at 0.
- Body 15px/400, line-height 1.55. Labels 12px/600 uppercase, 0.12em tracking, lavender.
- White cards: 16px radius, 1px border, 24–32px padding; shadow at most 0 1px 2px rgba(28,23,38,0.04).
- Primary buttons plum/white; secondary white/bordered; radius 12px; height 44px (48px on mobile).
- 8px spacing grid, consistent radii, crisp hairlines, high contrast.
- Motion only 150–200ms ease-out fades/lifts; honor reduced motion.

## Prohibited and required
- No decorative sparkles/asterisks or confetti. Photography only through the Imagery rules below.
- No cream or mango/orange tokens, Plus Jakarta Sans, photo-first cards, playful sidebar blocks, or greeting users as "friend".
- Calm, confident, warm copy; first-name greeting; short sentences, no hype.
- Show realistic sample data labeled "Sample" until real data exists. Never imply sample actions persist or services are connected.
- Preserve all five existing routes and complete English/Latin American Spanish translation coverage.

## Navigation
- At 768px and above: 248px surface sidebar, 1px right border; plum square/peach g logo and Gatherwell wordmark.
- Workspace block: NC initials, Nick's workspace, Growth plan · Sample.
- Home, Events, Team, Learn, Me; active item plum filled pill with white text/icon.
- Bottom sidebar note: Sample data. Changes last for this session.
- Under 768px: white blurred bottom tabs, top hairline, active plum; floating plum +; quiet functional assistant sparkle icon in header (only exception to sparkle prohibition).

## Home composition
- Desktop max width 1200px, 32px gutters. Workspace / Home breadcrumb, member-view button, SAMPLE badge and NC avatar.
- YOUR COMMUNITY, CONNECTED; Good morning, Nick.; weekly community subtitle; right-aligned + Create.
- Four stats: community members 128 (+12 this month), upcoming events 3 (Across your community), repeat attendance 68% (+8 pts vs. last month), check-ins 214 (+18%); icons and View details links.
- Two-column 2:1 layout: three upcoming events with September date tiles, venue/time, chips, attendance progress and Manage buttons; plum network feature with peach action and subtle concentric lines; community pulse timeline below it.
- Full-width follow-up card with three initials-avatar rows and secondary actions.
- Mobile: greeting, 2x2 stats, upcoming, network, pulse, follow-ups in one column; 44–48px targets.
- Events, Team, Learn, Me use premium framed lists with 2–3 realistic sample rows, not illustration empty states.

## NO EMOJI ANYWHERE
- No emoji in UI text, buttons, toasts, notifications, sample data, templates, recipes, challenges, translations, emails or stored content.
- Reactions and indicators use icons from the icon system, never emoji.

## Icons
- Phosphor Icons only (@phosphor-icons/react). Every icon renders through the single GwIcon component (`<GwIcon name variant="ui|feature" />`); named imports from `@/components/icons` are thin wrappers around it.
- UI icons (navigation, buttons, lists, inputs): Phosphor light weight, 20px, muted #8A8496; active or selected states plum #2F2340.
- Feature and category icons (category bubbles, feature tiles, empty states, badges): duotone weight, 24-28px, plum stroke with lavender #7A5FA8 fill at 20% opacity, inside a 56px tile (16px radius, #EFEBF6 background, 1px #E4DEF0 border) via GwFeatureTile.
- Never mix weights within one component; no filled cartoon icons or clip-art.
- Category map: Run clubs PersonSimpleRun, Fit camps Barbell, Yoga FlowerLotus, Sound baths Waveform, Hikes Mountains, Walks PersonSimpleWalk, Pickleball TennisBall, More SquaresFour.
- Badge medallions: 64px circle, 1.5px ring (bronze peach #F3C6A5, silver lavender #7A5FA8, gold plum #2F2340), centered duotone icon, subtle inner highlight.

## Imagery
- Art direction: candid real groups of mixed ages and backgrounds; natural warm light (sunrise or golden hour); genuine motion and laughter; outdoors in parks, trails and open studios. No posed studio models, gym selfies, visible brand logos or text in the image.
- Every photo renders through the shared BrandImage component: peach #F3C6A5 overlay at 6% soft-light, gentle bottom vignette, 2% film grain. Failed or missing photos fall back to a plum-lavender-peach tonal gradient with grain, never a grey box.
- Responsive sizes 640/1080/1600/2400, auto WebP/AVIF, quality 80. Uploads are cropped to the slot ratio around the focal point and saved as 2400px WebP.
- Photos live in site_media slots, swappable by platform admins in Me > Site media with no code changes: hero_card_1-4, feed_default_run, feed_default_fitcamp, feed_default_yoga, feed_default_soundbath, feed_default_hike, feed_default_walk, feed_default_pickleball, host_band, leaders_band, og_share_image. Credits are stored per slot.
