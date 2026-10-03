<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Gatherwell architecture
- Keep enduring product requirements in PROJECT_RULES.md; apply them to all future work.
- Use react-i18next with matched English and Latin American Spanish JSON resources for all visible and accessible copy, so language changes stay instant and complete.
- Keep shared navigation, settings, and sheets in GatherwellShell around the root Outlet; use separate leaf routes for the five tabs so deep links work.
- Accounts, profiles and teams are real (Lovable Cloud); creation actions for events, announcements, challenges and trainings still open coming-soon sheets until they are built.
- localStorage holds only language, theme and a pending invite code (cleared once the join completes); all user data lives in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only, without app-shell service workers, because offline use was not requested.
- DESIGN_RULES.md is authoritative for visuals and tone over PROJECT_RULES.md, so the permanent premium reset supersedes the initial shell design.
- Keep bilingual sample dashboard content and detail sheets frontend-only, with session state rather than stored user data, so previews never imply connected services.
- Team access checks go through the security-definer SQL function is_team_member(team, roles), which also grants leaders of ancestor teams access, so RLS stays non-recursive and sub-team rules live in one place.
- Guests read, create and cancel RSVPs only through security-definer functions keyed by checkin_code, so the rsvps table never needs an anonymous read policy that would expose contact details.
- Activity rows are written only by database triggers or backend code; signed-in clients have no insert grant.
- App screens live under _authenticated/_app: the _authenticated gate redirects signed-out visitors to /login, and the _app layout sends anyone not onboarded (or holding a pending invite) to /onboarding before rendering GatherwellShell.
- Public surfaces (/login, /join/$code, /e/$id, /terms, /privacy) render through AuthFrame inside ClientOnly so browser-detected language never causes hydration mismatches.
- Team creation and joining go through create_team / join_team_by_code / get_team_invite RPCs so slugs, join codes and roles are set server-side.
- Uploaded photos go to the private media bucket under the uploader's folder and are shown via signed URLs, because public buckets are blocked.
