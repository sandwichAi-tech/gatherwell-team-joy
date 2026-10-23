> **Historical record — pre Blueprint v4 (2026-10-23).** Not an active instruction. Where anything here conflicts with SOURCE_OF_TRUTH.md, Blueprint v4 wins.

# Gatherwell Feature Inventory

Snapshot: 2026-10-16. Status comes from reading the source plus spot checks. It is not a full click-through test.

Status key: **Working** · **Sample data** (shows sample data) · **Not connected** (waits on an outside account) · **Unfinished** · **Broken**

Feature flags today: `landing_testimonials` (on), `landing_headline` (off), `landing_sticky_host_experiment` (off). These flags only affect the marketing home page. No app route is behind a flag.

Outside accounts not connected yet: email (Resend/Mailgun), text (Twilio), push keys, payments (Stripe), maps, AI. Without them, messages are logged as **simulated** (see Admin > Mail), paid checkout stays blocked behind a clear notice, and AI returns preview text.

## Guest (no account)
| Route | What it does | Status | Flag |
|---|---|---|---|
| /e/$id | Public gathering page and RSVP (free), waiver, questions, waitlist | Working (confirmation email is simulated) | No |
| /e/$id paid | Ticket checkout | Not connected (Stripe) | No |
| /i/$code | Invite link that leads to a gathering RSVP | Working | No |
| /r/$code | Referral link | Working | No |
| /join/$code | Join a team from an invite code | Working | No |
| /unsubscribe/$token | Email preferences and opt-out | Working | No |
| Text replies IN/OUT/STOP | RSVP by text reply | Not connected (only admin simulation) | No |

## Member (signed in)
| Route | What it does | Status | Flag |
|---|---|---|---|
| /home | Personal Home: upcoming RSVPs, team activity | Working | No |
| /events | Upcoming / Hosting / Past tabs | Working | No |
| /progress | Badges, milestones, goals | Working | No |
| /circles | Joined Circles | Working; members' space is Unfinished (ME5) | No |
| /challenge/$id | Challenge check-ins, leaderboard | Working | No |
| /learn, track, lesson, recipes | Trainings and recipes | Working; some sample tracks remain | No |
| /me | Profile, privacy, notifications, language | Working | No |
| /onboarding | First-run choice: guest or host | Working | No |

## Host
| Route | What it does | Status | Flag |
|---|---|---|---|
| /start | Host setup checklist | Working | No |
| /gathering/new, /gathering/$id/edit | Create or edit a single gathering or weekly series | Working; no category in quick create | No |
| /event/$id | Host view of a gathering | Working | No |
| /event/$id/guests | Guest list, approvals, co-hosts | Working | No |
| /event/$id/checkin | QR/code check-in, walk-ins | Working | No |
| /offers, /offer/$id | Circles and offers | Free offers Working; paid Not connected | No |
| /promos | Promo codes | Working (only matter once paid is live) | No |
| /earnings | Payouts and earnings | Not connected (Stripe) | No |
| /plan | Plan and limits (Free / Advanced / Pro) | Upgrade Not connected (Stripe) | No |
| /locations | Studios and spaces | Working | No |
| /followups | AI follow-up drafts | Not connected (AI); preview text | No |
| /verify | Coach verification request | Working (not required yet) | No |
| /h/$slug | Public host page | Working; link preview image Unfinished | No |
| People list (PE1 to PE3) | Guest list with statuses | Unfinished (not built) | No |

## Leader / Team
| Route | What it does | Status | Flag |
|---|---|---|---|
| /team | Team space: members, activity wins, announcements, shout-outs | Working | No |
| /team/insights | Activity counts (never sales) | Working | No |
| /team/map | Team map | Not connected (maps key); list fallback | No |
| /plan/seats | Team License seats | Working (license purchase Not connected) | No |
| /learn/manage | Publish trainings | Working | No |
| /network | Host connections and shares | Working | No |
| /t/$slug | Public team page | Working | No |

Specifics:
- **Inviting a whole organization:** join code / invite link per team (`/join/$code`), with inviter tracking. No bulk email/CSV invite. Partly done.
- **Sub-teams:** create sub-teams; leaders see the whole tree in the team and calendar views. Working.
- **Templates and launching them:** leader templates plus starter templates; launch creates the gathering and copies the checklist. Working.
- **Team activity / rhythm:** activity wins feed and Insights counts. There is no "weekly rhythm" view. Partly done.
- **Monthly team reports:** none. Not built.
- **Recognition / Host of the Month:** Host of the Month, Member of the Month, leader-awarded badges, automatic badges. Working.
- **Team Licenses and seats:** seat assignment works. Buying 25/100 seats is Not connected (Stripe); admins can grant a preview license.

## Admin
| Route | What it does | Status | Flag |
|---|---|---|---|
| /admin?tab=overview | Platform totals | Working | No |
| teams / users | Search teams and people, actions | Working; scorecard and timeline Unfinished (AD3) | No |
| moderation / verify | Reports and verification queue | Working; unified Trust inbox Unfinished (AD7) | No |
| library / broadcasts | Starter content and announcements | Working | No |
| founding / day60 | Founding coaches, Day-60 scoreboard | Working | No |
| settings | Plan prices and fees | Working | No |
| audit | Admin action log | Working | No |
| mail | Outbound message log with filters and counters | Working (new; shows simulated while no senders) | No |
| /admin/site-media | Site photos | Working | No |
| Analytics funnel (AD5/AD6) | | Unfinished (not built) | No |

## Public pages
| Route | What it does | Status | Flag |
|---|---|---|---|
| / | Marketing home | Working (testimonials flag on) | Yes, partly |
| /discover | Find gatherings | Working; uses sample gatherings when there are few real ones | No |
| /hosts, /studios, /pricing | Marketing pages | Working | No |
| /l/$slug | Public location page | Working; link preview image Unfinished | No |
| /login | Google and email link sign-in | Working | No |
| /terms, /privacy, /legal/$doc, /credits | Legal pages | Working | No |
| /help, /safety | | Unfinished (missing) | No |
| /sitemap.xml | Sitemap | Working | No |

## The 10 places a brand-new host is most likely to get stuck
1. Expecting confirmation emails to arrive. They are simulated until an email service is connected.
2. Trying to charge for a gathering. Paid checkout is blocked until payments are connected, so free is the only working path.
3. Not knowing which first step to take. Home vs `/start` vs "New gathering" compete.
4. The RSVP form is longer than guests expect (several fields), so hosts worry about drop-off.
5. No category in quick create, so gatherings look generic in Discover.
6. Sharing a link and getting a plain preview card (no host photo or price) on social apps.
7. Seeing leftover sample tracks and sample gatherings and wondering what is real.
8. Reminders are off by default; hosts assume guests are reminded.
9. No Help or Safety page to turn to.
10. No People list yet, so it is hard to see who came back or who is slipping.
