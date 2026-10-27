# Row 115: Resources, courses and Wellness assessments

## Current architecture and reproduced gaps
- Resources uses tracks/lessons, recipes, quizzes and commerce offers. The type chooser is ungrouped and has no Wellness assessment.
- The Create resource course path edits only its first track, while the existing course studio supports multiple sections. Quiz and other course attachments appear separately from lessons and have no shared ordering.
- Lesson/section swaps use independent writes, so equal positions or partial failures can leave order unchanged or inconsistent. Course links already fit the lesson model but are hidden behind generic lesson creation.
- Existing quizzes grade correct answers or map selected outcomes; they cannot truthfully act as weighted wellness assessments. No approved assessment disclaimer was found.

## Changes
1. Group supported resource choices by purpose, with Course and Wellness assessment first. Preserve standalone Link and type-appropriate media editors.
2. Reuse the existing multi-section course studio inside the staged resource builder: Presentation, Curriculum, Access & pricing, Preview/Review. Add clear inline lesson/link and quiz/assessment entry points, one active-language input, and learner-order preview.
3. Make section/item ordering transactional, owner-checked and stable. Keep existing reusable resources independent; add only references supported by the authoritative access model, otherwise show a truthful restriction rather than silently moving or copying them.
4. Extend the existing quiz-backed resource model with an explicit assessment identity and dedicated staged builder. Persist supported weighted choice questions, optional unscored text, complete 0–100 result ranges, draft settings and explicit retakes. Keep completion immutable/idempotent and answer reads participant/authorized-host scoped.
5. Require an approved versioned assessment scope/disclaimer before publication or participant collection. Authors can save and preview without fake participant records. Paid access remains blocked until the verified entitlement/payment path permits it; no invented checkout or recommendations.

## Verification and boundaries
- Focused and full tests; isolated two-host/two-learner/outsider checks; EN/Latin American Spanish at 320/390/1280; keyboard/focus, bad URLs, saved order, retries and cleanup.
- Document exact unsupported reuse/recommendation types, legal-copy/provider/device gaps, and Completed versus In Progress in the change log.
- No publication/deployment, real users, uploads, charges or messages. Database changes affect the shared backend immediately and remain additive, narrowly scoped to new assessment/curriculum operations.

## Technical details
- Preserve offers/tracks/lessons/quizzes, configure_resource_access, course-release enforcement and existing ownership/RLS. No parallel demo state or new commerce model.
- Use additive database changes through the migration tool, explicit grants/RLS, transactional RPC validation and owner-scoped draft reads. Assessment scores do not affect quiz pass rules or certificates.
- With no approved assessment scope copy, positive participant publication/completion checks remain blocked and are reported unverified, not simulated as live.