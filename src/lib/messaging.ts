/**
 * Communications hub rules — client-safe mirrors of the server checks in
 * save_message_template / save_message_automation / save_message_journey
 * (migration 0095). The RPCs are authoritative.
 */

export const MESSAGE_CHANNELS = ['email', 'sms', 'in_app'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** Triggers the platform can truthfully fire today (DB triggers enqueue into notification_outbox). */
export const MESSAGE_TRIGGERS = ['registration_confirmation', 'event_reminder', 'event_cancellation'] as const;
export const JOURNEY_TRIGGERS = [...MESSAGE_TRIGGERS, 'resource_enrollment'] as const;
export type MessageTrigger = (typeof MESSAGE_TRIGGERS)[number];

/** Conditions a journey step can actually evaluate against platform data. */
export const JOURNEY_CONDITIONS = ['rsvp_status_going', 'event_not_full', 'not_checked_in', 'enrollment_active'] as const;
export type JourneyCondition = (typeof JOURNEY_CONDITIONS)[number];

export const JOURNEY_STEP_KINDS = ['wait', 'send', 'condition'] as const;
export type JourneyStepKind = (typeof JOURNEY_STEP_KINDS)[number];

export type JourneyStep =
  | { kind: 'wait'; hours: number }
  | { kind: 'send'; template_id: string }
  | { kind: 'condition'; condition: JourneyCondition };

export const MAX_BODY = 4000;
export const MAX_SMS_BODY = 480;
export const MAX_NAME = 120;
export const MAX_STEPS = 20;
export const MAX_WAIT_HOURS = 720;

/** Variables the renderer substitutes (render_message_vars in the database). */
export const TEMPLATE_VARIABLES = ['name', 'event', 'resource', 'date', 'host'] as const;

export function extractVariables(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\{\{([a-z_]+)\}\}/g)) out.add(m[1] ?? '');
  out.delete('');
  return [...out];
}

export function validateTemplateDraft(d: { name: string; channel: string; body: string }): string | null {
  if (!d.name.trim() || d.name.length > MAX_NAME) return 'invalid_name';
  if (!MESSAGE_CHANNELS.includes(d.channel as MessageChannel)) return 'invalid_channel';
  if (!d.body.trim() || d.body.length > MAX_BODY) return 'invalid_body';
  if (d.channel === 'sms' && d.body.length > MAX_SMS_BODY) return 'sms_too_long';
  return null;
}

export function validateAutomationDraft(d: { name: string; trigger: string; channel: string; timing_hours: number }): string | null {
  if (!d.name.trim() || d.name.length > MAX_NAME) return 'invalid_name';
  if (!MESSAGE_TRIGGERS.includes(d.trigger as MessageTrigger)) return 'invalid_trigger';
  if (!MESSAGE_CHANNELS.includes(d.channel as MessageChannel)) return 'invalid_channel';
  if (!Number.isInteger(d.timing_hours) || d.timing_hours < 1 || d.timing_hours > MAX_WAIT_HOURS) return 'invalid_timing';
  return null;
}

/** Mirrors save_message_journey's step validation. */
export function validateJourneySteps(steps: JourneyStep[], templateOk: (id: string) => boolean): string | null {
  if (!steps.length || steps.length > MAX_STEPS) return 'invalid_steps';
  for (const s of steps) {
    if (s.kind === 'wait') {
      if (!Number.isInteger(s.hours) || s.hours < 1 || s.hours > MAX_WAIT_HOURS) return 'invalid_wait';
    } else if (s.kind === 'send') {
      if (!s.template_id || !templateOk(s.template_id)) return 'template_not_found';
    } else if (s.kind === 'condition') {
      if (!JOURNEY_CONDITIONS.includes(s.condition)) return 'invalid_condition';
    } else return 'invalid_step_kind';
  }
  return null;
}

/** A journey can only activate when it contains at least one send step. */
export function journeyCanActivate(steps: JourneyStep[]): boolean {
  return steps.some(s => s.kind === 'send');
}

/** Reorder helper for accessible up/down moves. */
export function moveStep<T>(steps: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= steps.length) return steps;
  const next = [...steps];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item as T);
  return next;
}
