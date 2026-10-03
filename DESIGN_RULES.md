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
- Lucide icons: 20px, 1.5px stroke, muted unless part of an active or primary control.
- 8px spacing grid, consistent radii, crisp hairlines, high contrast.
- Motion only 150–200ms ease-out fades/lifts; honor reduced motion.

## Prohibited and required
- No stock photos, people hero images, decorative sparkles/asterisks, emoji or confetti.
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
