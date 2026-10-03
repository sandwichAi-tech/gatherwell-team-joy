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
- This stage is frontend-only: creation actions open explicit coming-soon sheets, never imply saved data or connected services.
- Store only language and theme preferences in localStorage; future user data belongs in Lovable Cloud with team-scoped RLS.
- Home-screen installation is manifest-only, without app-shell service workers, because offline use was not requested.
- DESIGN_RULES.md is authoritative for visuals and tone over PROJECT_RULES.md, so the permanent premium reset supersedes the initial shell design.
- Keep bilingual sample dashboard content and detail sheets frontend-only, with session state rather than stored user data, so previews never imply connected services.
- Team access checks go through the security-definer SQL function is_team_member(team, roles), which also grants leaders of ancestor teams access, so RLS stays non-recursive and sub-team rules live in one place.
- Guests read, create and cancel RSVPs only through security-definer functions keyed by checkin_code, so the rsvps table never needs an anonymous read policy that would expose contact details.
- Activity rows are written only by database triggers or backend code; signed-in clients have no insert grant.
