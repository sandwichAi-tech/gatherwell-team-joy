import { describe, expect, it } from 'vitest';
import {
  MESSAGE_CHANNELS, MESSAGE_TRIGGERS, JOURNEY_CONDITIONS,
  extractVariables, validateTemplateDraft, validateAutomationDraft, validateJourneySteps, journeyCanActivate, moveStep,
  type JourneyStep,
} from './messaging';

describe('message channel and trigger allowlists', () => {
  it('only supports email, sms and in_app channels', () => {
    expect(MESSAGE_CHANNELS).toEqual(['email', 'sms', 'in_app']);
  });
  it('only offers triggers the platform can truthfully fire', () => {
    expect(MESSAGE_TRIGGERS).toEqual(['registration_confirmation', 'event_reminder', 'event_cancellation']);
  });
  it('only offers conditions the platform can evaluate', () => {
    expect(JOURNEY_CONDITIONS).toEqual(['rsvp_status_going', 'event_not_full', 'not_checked_in']);
  });
});

describe('extractVariables', () => {
  it('finds unique lowercase variables in order', () => {
    expect(extractVariables('Hi {{name}}, see you at {{event}} on {{date}}. {{name}}')).toEqual(['name', 'event', 'date']);
  });
  it('ignores malformed or uppercase placeholders', () => {
    expect(extractVariables('{{Name}} {{ name }} {{1x}} {{}}')).toEqual([]);
  });
});

describe('validateTemplateDraft', () => {
  const base = { name: 'Welcome', channel: 'email', body: 'Hi {{name}}' };
  it('accepts a valid draft', () => expect(validateTemplateDraft(base)).toBeNull());
  it('rejects empty and over-long names', () => {
    expect(validateTemplateDraft({ ...base, name: '  ' })).toBe('invalid_name');
    expect(validateTemplateDraft({ ...base, name: 'x'.repeat(121) })).toBe('invalid_name');
  });
  it('rejects unknown channels', () => expect(validateTemplateDraft({ ...base, channel: 'whatsapp' })).toBe('invalid_channel'));
  it('rejects empty bodies', () => expect(validateTemplateDraft({ ...base, body: '' })).toBe('invalid_body'));
  it('caps SMS bodies at 480 characters', () => {
    expect(validateTemplateDraft({ ...base, channel: 'sms', body: 'x'.repeat(481) })).toBe('sms_too_long');
    expect(validateTemplateDraft({ ...base, channel: 'sms', body: 'x'.repeat(480) })).toBeNull();
  });
});

describe('validateAutomationDraft', () => {
  const base = { name: 'Reminder', trigger: 'event_reminder', channel: 'email', timing_hours: 24 };
  it('accepts a valid draft', () => expect(validateAutomationDraft(base)).toBeNull());
  it('rejects unsupported triggers', () => expect(validateAutomationDraft({ ...base, trigger: 'birthday' })).toBe('invalid_trigger'));
  it('bounds timing to 1..720 hours', () => {
    expect(validateAutomationDraft({ ...base, timing_hours: 0 })).toBe('invalid_timing');
    expect(validateAutomationDraft({ ...base, timing_hours: 721 })).toBe('invalid_timing');
    expect(validateAutomationDraft({ ...base, timing_hours: 2.5 })).toBe('invalid_timing');
  });
});

describe('journey steps', () => {
  const ok = (id: string) => id === 'tpl-1';
  it('rejects empty and oversized journeys', () => {
    expect(validateJourneySteps([], ok)).toBe('invalid_steps');
    expect(validateJourneySteps(Array(21).fill({ kind: 'wait', hours: 1 }), ok)).toBe('invalid_steps');
  });
  it('validates wait bounds', () => {
    expect(validateJourneySteps([{ kind: 'wait', hours: 0 }], ok)).toBe('invalid_wait');
    expect(validateJourneySteps([{ kind: 'wait', hours: 48 }], ok)).toBeNull();
  });
  it('requires send steps to reference an existing template', () => {
    expect(validateJourneySteps([{ kind: 'send', template_id: 'nope' }], ok)).toBe('template_not_found');
    expect(validateJourneySteps([{ kind: 'send', template_id: 'tpl-1' }], ok)).toBeNull();
  });
  it('rejects conditions the platform cannot evaluate', () => {
    expect(validateJourneySteps([{ kind: 'condition', condition: 'is_happy' as never }], ok)).toBe('invalid_condition');
  });
  it('only activates with at least one send step', () => {
    expect(journeyCanActivate([{ kind: 'wait', hours: 1 }])).toBe(false);
    expect(journeyCanActivate([{ kind: 'wait', hours: 1 }, { kind: 'send', template_id: 'tpl-1' }])).toBe(true);
  });
});

describe('moveStep', () => {
  const steps: JourneyStep[] = [{ kind: 'wait', hours: 1 }, { kind: 'send', template_id: 'a' }, { kind: 'condition', condition: 'event_not_full' }];
  it('moves a step up and down', () => {
    expect(moveStep(steps, 1, -1)[0]).toEqual({ kind: 'send', template_id: 'a' });
    expect(moveStep(steps, 1, 1)[2]).toEqual({ kind: 'send', template_id: 'a' });
  });
  it('is a no-op at the edges', () => {
    expect(moveStep(steps, 0, -1)).toBe(steps);
    expect(moveStep(steps, 2, 1)).toBe(steps);
  });
});
